// server/execution/localShellAdapter.ts
//
// Previews approved commands on the host machine.
// Phase 1: dry-run only — logs what would run, returns simulated output.
// Real execution will be wired after user review.

import type { ExecutionAdapter, ExecutionRequest, ExecutionResult } from './types';

export class LocalShellAdapter implements ExecutionAdapter {
  name = 'local-shell';

  async available(): Promise<boolean> {
    // Local shell preview is always available on the host machine.
    return true;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const start = Date.now();

    // ── DRY-RUN MODE (Phase 1) ─────────────────────────────────────────
    // Nothing actually runs. This adapter returns a simulated result
    // showing exactly what would happen. Real execution is gated behind
    // user review — see docs/MYAI_PORTAL_CONTRACT.md.

    console.log(
      `[LocalShell] DRY-RUN: would execute "${request.command}" ` +
      `in ${request.workspacePath} (risk: ${request.allowlistEntry.risk})`
    );

    return {
      id: request.id,
      success: true,
      exitCode: 0,
      stdout: [
        `[dry-run] local-shell adapter`,
        `[dry-run] command: ${request.command}`,
        `[dry-run] workspace: ${request.workspaceName} (${request.workspacePath})`,
        `[dry-run] risk: ${request.allowlistEntry.risk}`,
        `[dry-run] description: ${request.allowlistEntry.description}`,
        ``,
        `No actual execution — dry-run mode active.`,
        `Approve real execution in a future portal release.`,
      ].join('\n'),
      stderr: '',
      durationMs: Date.now() - start,
      adapter: this.name,
      dryRun: true,
    };
  }
}
