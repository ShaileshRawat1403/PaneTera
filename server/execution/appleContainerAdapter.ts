// server/execution/appleContainerAdapter.ts
//
// Previews approved commands inside an Apple Container (Linux VM on Apple Silicon).
// Requires macOS 26+ and the `container` CLI tool from apple/container.
//
// Phase 1: dry-run only — checks `container` availability, logs what would
// run, returns simulated output. Real execution wired after user review.
//
// References:
//   https://github.com/apple/container
//   https://github.com/apple/containerization

import { spawnSync } from 'child_process';
import type { ExecutionAdapter, ExecutionRequest, ExecutionResult } from './types';

/** Default OCI image for running commands in the container */
const DEFAULT_IMAGE = 'docker.io/library/alpine:latest';

/**
 * The container image needs common dev tools installed. In production this
 * would be a custom image with node, cargo, git etc. For the POC we use
 * Alpine and note the limitation.
 */
const NODE_IMAGE = 'docker.io/library/node:22-alpine';

export class AppleContainerAdapter implements ExecutionAdapter {
  name = 'apple-container';

  /**
   * Check if Apple Containers are available on this system.
   * Requires macOS 26+ and the `container` CLI.
   */
  async available(): Promise<boolean> {
    try {
      const result = spawnSync('container', ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      if (result.error || result.status !== 0) {
        return false;
      }
      const version = String(result.stdout || '').trim();
      console.log(`[AppleContainer] Found container CLI: ${version}`);
      return true;
    } catch {
      return false;
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const start = Date.now();

    // ── Availability check ───────────────────────────────────────────────
    const isAvailable = await this.available();

    // ── DRY-RUN MODE (Phase 1) ─────────────────────────────────────────
    // Nothing actually runs in a container. This adapter checks if the
    // container CLI exists and returns what the full command would look
    // like. Real container execution is gated behind user review.

    const image = this.selectImage(request.command);

    const containerArgs = [
      'run', '--rm',
      ...(request.workspacePath
        ? ['--mount', `type=bind,source=${request.workspacePath},target=/workspace`]
        : []),
      image,
      'sh', '-c', `cd /workspace && ${request.command}`,
    ];
    const containerPreview = ['container', ...containerArgs]
      .map((part) => JSON.stringify(part))
      .join(' ');

    console.log(
      `[AppleContainer] DRY-RUN: would execute ${containerPreview} ` +
      `(risk: ${request.allowlistEntry.risk}, available: ${isAvailable})`
    );

    return {
      id: request.id,
      success: true,
      exitCode: 0,
      stdout: [
        `[dry-run] apple-container adapter`,
        `[dry-run] container CLI available: ${isAvailable}`,
        `[dry-run] image: ${image}`,
        `[dry-run] command: ${request.command}`,
        `[dry-run] workspace: ${request.workspaceName} (${request.workspacePath})`,
        `[dry-run] bind mount: ${request.workspacePath} -> /workspace`,
        `[dry-run] risk: ${request.allowlistEntry.risk}`,
        `[dry-run] full container command:`,
        `[dry-run]   ${containerPreview}`,
        ``,
        isAvailable
          ? `Container CLI is available. Ready for real execution after review.`
          : `Container CLI not found. Install from https://github.com/apple/container`,
      ].join('\n'),
      stderr: '',
      durationMs: Date.now() - start,
      adapter: this.name,
      dryRun: true,
    };
  }

  /**
   * Select the appropriate container image based on the command.
   * npm/node commands need the node image; cargo needs rust; git needs basic tools.
   */
  private selectImage(command: string): string {
    if (command.startsWith('npm ') || command.startsWith('node ')) {
      return NODE_IMAGE;
    }
    // Phase 1 is dry-run only; real execution will need purpose-built images.
    return DEFAULT_IMAGE;
  }
}
