import { PANETERA_ASSISTANT_INSTRUCTION } from '../assistantInstruction';
import type {
  AgentCapability,
  AgentModelProvider,
  AgentRequest,
  AgentRunResult,
  AgentPendingApproval,
  AgentToolResult,
} from './types';
import { AgentRunStore } from './runStore';
import { StoreEventSink, type OperatorEventSink } from './operatorSink';
import {
  runToolLoop,
  type ModelTurn,
  type ToolExecution,
  type AgentToolCall as LoopToolCall,
} from '../agentLoop';

const MAX_MODEL_TURNS = 8;

export class AgentRuntime {
  private readonly capabilities = new Map<string, AgentCapability>();
  private readonly active = new Map<string, AbortController>();

  constructor(
    private readonly store: AgentRunStore,
    private readonly provider: AgentModelProvider,
    capabilities: AgentCapability[],
  ) {
    for (const capability of capabilities) {
      if (this.capabilities.has(capability.name)) throw new Error(`Duplicate capability: ${capability.name}`);
      this.capabilities.set(capability.name, capability);
    }
  }

  async run(request: AgentRequest): Promise<AgentRunResult> {
    const objective = request.objective?.trim();
    if (!objective) throw new Error('Agent objective is required.');

    const run = await this.store.create({
      objective: (request.recordedObjective || objective).trim(),
      provider: this.provider.providerId,
      model: this.provider.modelId,
      context: request.context,
    });
    const controller = new AbortController();
    this.active.set(run.runId, controller);
    const sink: OperatorEventSink = new StoreEventSink(this.store, run.runId);
    let uiComponent: unknown;
    let finalText = '';
    let awaitingApproval = false;
    let pendingApproval: AgentPendingApproval | undefined;

    try {
      await sink.transition('planning', { currentStep: 'Compile bounded context' });
      await sink.emit('run.started', 'PaneTera started the task.');
      await sink.emit('context.compiled', 'Bounded context compiled.', {
        contextItems: request.context?.length || 0,
        rawMaterialPersisted: false,
      });
      await sink.emit('plan.created', 'Inspect with governed tools, act only through policy, then report evidence.', {
        availableCapabilities: [...this.capabilities.keys()],
      });

      // The shared operator spine (runToolLoop) drives the turns. These closures
      // are the only runtime-specific parts: they thread the provider's
      // continuation state, emit the run's events through the sink, and capture
      // the approval/final-text outcome the post-loop logic needs. The loop
      // itself is provider- and store-agnostic, identical to the chat path.
      const toolDefinitions = [...this.capabilities.values()].map(({ execute: _execute, ...definition }) => definition);
      let continuationId: string | undefined;
      let pendingToolOutputs: Array<{ callId: string; output: unknown }> | undefined;
      let turn = 0;

      const callModel = async (): Promise<ModelTurn> => {
        this.assertActive(run.runId, controller.signal);
        turn += 1;
        await sink.transition('running', { currentStep: 'Reason and select the next governed action' });
        await sink.emit('model.started', 'Reasoning engine started.', {
          provider: this.provider.providerId,
          model: this.provider.modelId,
          turn,
        });
        const toolOutputs = pendingToolOutputs;
        pendingToolOutputs = undefined;
        const response = await this.provider.generate({
          instruction: PANETERA_ASSISTANT_INSTRUCTION,
          objective,
          history: request.history || [],
          tools: toolDefinitions,
          previousResponseId: continuationId,
          toolOutputs,
          signal: controller.signal,
        });
        continuationId = response.continuationId;
        await sink.emit('model.completed', 'Reasoning engine returned an operational decision.', {
          toolCallCount: response.toolCalls.length,
          hasResponseText: Boolean(response.text),
        });
        if (response.text) finalText = response.text;
        return {
          text: response.text,
          toolCalls: response.toolCalls.map((call) => ({ name: call.name, args: call.arguments, id: call.callId })),
        };
      };

      const executeTool = async (call: LoopToolCall): Promise<ToolExecution> => {
        this.assertActive(run.runId, controller.signal);
        const capability = this.capabilities.get(call.name);
        if (!capability) {
          await sink.emit('tool.failed', `Unavailable capability: ${call.name}`, { capability: call.name });
          return { output: { error: `Capability is not present in the active Rig: ${call.name}` } };
        }
        await sink.emit('tool.started', `Using ${call.name}.`, { capability: call.name, risk: capability.risk });
        try {
          const result = await capability.execute(call.args);
          if (result.uiComponent) uiComponent = result.uiComponent;
          await this.recordToolResult(sink, call.name, result);
          if (result.requiresApproval) {
            awaitingApproval = true;
            pendingApproval = result.approval;
          }
          return { output: result.output, uiComponent: result.uiComponent };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          await sink.emit('tool.failed', `${call.name} failed.`, { capability: call.name });
          return { output: { error: message } };
        }
      };

      const recordToolResult = (call: LoopToolCall, execution: ToolExecution): void => {
        (pendingToolOutputs ??= []).push({ callId: call.id ?? call.name, output: execution.output });
      };

      const loopResult = await runToolLoop({ callModel, executeTool, recordToolResult, maxTurns: MAX_MODEL_TURNS });
      if (loopResult.stopReason === 'budget') {
        throw new Error(`Agent exceeded the ${MAX_MODEL_TURNS}-turn tool limit without reaching a final response.`);
      }
      this.assertActive(run.runId, controller.signal);
      const reply = finalText || (awaitingApproval
        ? 'I prepared a governed action proposal. Review its exact target and command before approving it.'
        : 'I completed the available inspection but did not receive a textual response.');
      const status = awaitingApproval ? 'waiting-approval' : 'completed';
      if (awaitingApproval && !pendingApproval) {
        throw new Error('A capability requested approval without an exact approval record.');
      }
      if (
        awaitingApproval
        && uiComponent
        && typeof uiComponent === 'object'
        && 'data' in uiComponent
      ) {
        const component = uiComponent as { data: unknown };
        if (component.data && typeof component.data === 'object') {
          component.data = { ...(component.data as Record<string, unknown>), runId: run.runId };
        }
      }
      await sink.emit('response.completed', 'Response prepared.', {
        awaitingApproval,
      });
      await sink.transition(status, {
        currentStep: awaitingApproval ? 'Waiting for exact user approval' : null,
        reply,
        uiComponent,
        pendingApproval,
      });
      if (!awaitingApproval) await sink.emit('run.completed', 'Task completed.');

      return {
        runId: run.runId,
        status,
        reply,
        uiComponent,
        provider: this.provider.providerId,
        model: this.provider.modelId,
        events: this.store.listEvents(run.runId),
      };
    } catch (error: unknown) {
      if (this.store.isCanceled(run.runId) || controller.signal.aborted) {
        const canceled = this.store.get(run.runId);
        return {
          runId: run.runId,
          status: 'canceled',
          reply: canceled?.reply || 'Task canceled.',
          provider: this.provider.providerId,
          model: this.provider.modelId,
          events: this.store.listEvents(run.runId),
        };
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.store.transition(run.runId, 'failed', {
        currentStep: null,
        error: 'The reasoning or capability loop failed. The detailed error was not persisted.',
      });
      await this.store.append(run.runId, 'run.failed', 'Task failed.', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      throw Object.assign(new Error(message), { runId: run.runId });
    } finally {
      this.active.delete(run.runId);
    }
  }

  getStore(): AgentRunStore {
    return this.store;
  }

  async cancel(runId: string) {
    this.active.get(runId)?.abort();
    return this.store.cancel(runId);
  }

  private assertActive(runId: string, signal: AbortSignal): void {
    if (signal.aborted || this.store.isCanceled(runId)) throw new Error('Agent run canceled.');
  }

  private async recordToolResult(sink: OperatorEventSink, capability: string, result: AgentToolResult): Promise<void> {
    await sink.emit('tool.completed', `${capability} returned observed output.`, {
      capability,
      evidence: result.evidence || {},
      requiresApproval: Boolean(result.requiresApproval),
    });
    if (result.requiresApproval) {
      await sink.emit('approval.required', 'Exact user approval is required before execution.', {
        capability,
      });
    }
  }
}
