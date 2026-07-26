// server/browserObservationRequestStore.ts
//
// Tracks pending observation requests that the Chrome extension polls for.
// Used for automatic observation polling when the user has a live browser session.

import { randomUUID } from 'crypto';

export type ObservationRequestStatus = 'queued' | 'claimed' | 'completed' | 'failed' | 'expired';

export interface BrowserObservationRequest {
  requestId: string;
  installationId: string;
  status: ObservationRequestStatus;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
  completedAt?: string;
  captureId?: string;
  error?: string;
}

const REQUEST_TTL_MS = 30_000; // 30 seconds

export class BrowserObservationRequestStore {
  private readonly requests = new Map<string, BrowserObservationRequest>();

  create(installationId: string): BrowserObservationRequest {
    const now = new Date();
    const request: BrowserObservationRequest = {
      requestId: `obs-req-${randomUUID()}`,
      installationId,
      status: 'queued',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
    };
    this.requests.set(request.requestId, request);
    return structuredClone(request);
  }

  claimNext(installationId: string): BrowserObservationRequest | undefined {
    for (const request of this.requests.values()) {
      this.expire(request);
      if (request.installationId !== installationId || request.status !== 'queued') continue;
      request.status = 'claimed';
      request.claimedAt = new Date().toISOString();
      return structuredClone(request);
    }
    return undefined;
  }

  complete(
    requestId: string,
    installationId: string,
    result: { status: 'completed' | 'failed'; captureId?: string; error?: string },
  ): BrowserObservationRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Observation request not found');
    this.expire(request);
    if (request.status !== 'claimed') {
      throw new Error(`Observation request cannot complete from status ${request.status}`);
    }
    if (request.installationId !== installationId) {
      throw new Error('Observation request installation binding mismatch');
    }
    request.status = result.status;
    request.completedAt = new Date().toISOString();
    if (result.status === 'completed') {
      request.captureId = result.captureId;
    } else {
      request.error = result.error || 'Observation failed';
    }
    return structuredClone(request);
  }

  private expire(request: BrowserObservationRequest): void {
    if (
      ['queued', 'claimed'].includes(request.status)
      && Date.now() > new Date(request.expiresAt).getTime()
    ) request.status = 'expired';
  }
}

export const browserObservationRequestStore = new BrowserObservationRequestStore();
