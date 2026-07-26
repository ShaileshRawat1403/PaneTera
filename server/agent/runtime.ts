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
    let uiComponent: unknown;
    let continuationId: string | undefined;
    let toolOutputs: Array<{ callId: string; output: unknown }> | undefined;
    let finalText = '';
    let awaitingApproval = false;
    let pendingApproval: AgentPendingApproval | undefined;
    let reachedFinalResponse = false;

    try {
      await this.store.transition(run.runId, 'planning', { currentStep: 'Compile bounded context' });
      await this.store.append(run.runId, 'run.started', 'PaneTera started the task.');
      await this.store.append(run.runId, 'context.compiled', 'Bounded context compiled.', {
        contextItems: request.context?.length || 0,
        rawMaterialPersisted: false,
      });
      await this.store.append(run.runId, 'plan.created', 'Inspect with governed tools, act only through policy, then report evidence.', {
        availableCapabilities: [...this.capabilities.keys()],
      });

      for (let turn = 0; turn < MAX_MODEL_TURNS; turn += 1) {
        this.assertActive(run.runId, controller.signal);
        await this.store.transition(run.runId, 'running', { currentStep: 'Reason and select the next governed action' });
        await this.store.append(run.runId, 'model.started', 'Reasoning engine started.', {
          provider: this.provider.providerId,
          model: this.provider.modelId,
          turn: turn + 1,
        });

        const response = await this.provider.generate({
          instruction: PANETERA_ASSISTANT_INSTRUCTION,
          objective,
          history: request.history || [],
          tools: [...this.capabilities.values()].map(({ execute: _execute, ...definition }) => definition),
          previousResponseId: continuationId,
          toolOutputs,
          signal: controller.signal,
        });
        continuationId = response.continuationId;
        await this.store.append(run.runId, 'model.completed', 'Reasoning engine returned an operational decision.', {
          toolCallCount: response.toolCalls.length,
          hasResponseText: Boolean(response.text),
        });

        if (response.toolCalls.length === 0) {
          finalText = response.text || finalText;
          reachedFinalResponse = true;
          break;
        }

        toolOutputs = [];
        for (const call of response.toolCalls) {
          this.assertActive(run.runId, controller.signal);
          const capability = this.capabilities.get(call.name);
          if (!capability) {
            const output = { error: `Capability is not present in the active Rig: ${call.name}` };
            toolOutputs.push({ callId: call.callId, output });
            await this.store.append(run.runId, 'tool.failed', `Unavailable capability: ${call.name}`, {
              capability: call.name,
            });
            continue;
          }

          await this.store.append(run.runId, 'tool.started', `Using ${call.name}.`, {
            capability: call.name,
            risk: capability.risk,
          });
          try {
            const result = await capability.execute(call.arguments);
            toolOutputs.push({ callId: call.callId, output: result.output });
            if (result.uiComponent) uiComponent = result.uiComponent;
            await this.recordToolResult(run.runId, call.name, result);
            if (result.requiresApproval) {
              awaitingApproval = true;
              pendingApproval = result.approval;
            }
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toolOutputs.push({ callId: call.callId, output: { error: message } });
            await this.store.append(run.runId, 'tool.failed', `${call.name} failed.`, {
              capability: call.name,
            });
          }
        }
        if (response.text) finalText = response.text;
      }

      if (!reachedFinalResponse) {
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
      await this.store.append(run.runId, 'response.completed', 'Response prepared.', {
        awaitingApproval,
      });
      await this.store.transition(run.runId, status, {
        currentStep: awaitingApproval ? 'Waiting for exact user approval' : null,
        reply,
        uiComponent,
        pendingApproval,
      });
      if (!awaitingApproval) await this.store.append(run.runId, 'run.completed', 'Task completed.');

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

  private async recordToolResult(runId: string, capability: string, result: AgentToolResult): Promise<void> {
    await this.store.append(runId, 'tool.completed', `${capability} returned observed output.`, {
      capability,
      evidence: result.evidence || {},
      requiresApproval: Boolean(result.requiresApproval),
    });
    if (result.requiresApproval) {
      await this.store.append(runId, 'approval.required', 'Exact user approval is required before execution.', {
        capability,
      });
    }
  }
}
