import { randomUUID } from 'crypto';

export type BrowserInspectionStatus = 'queued' | 'claimed' | 'completed' | 'failed' | 'expired';

export interface BrowserInspectionRequest {
  requestId: string;
  installationId: string;
  capability: 'browser.elements.discover';
  status: BrowserInspectionStatus;
  createdAt: string;
  expiresAt: string;
  claimedAt?: string;
  completedAt?: string;
  captureId?: string;
  extractionId?: string;
  error?: string;
}

const REQUEST_TTL_MS = 60_000;

export class BrowserInspectionStore {
  private readonly requests = new Map<string, BrowserInspectionRequest>();

  create(installationId: string): BrowserInspectionRequest {
    const normalized = bounded(installationId, 'installationId', 200);
    const now = new Date();
    const request: BrowserInspectionRequest = {
      requestId: `browser-inspection-${randomUUID()}`,
      installationId: normalized,
      capability: 'browser.elements.discover',
      status: 'queued',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REQUEST_TTL_MS).toISOString(),
    };
    this.requests.set(request.requestId, request);
    return structuredClone(request);
  }

  get(requestId: string): BrowserInspectionRequest | undefined {
    const request = this.requests.get(requestId);
    if (!request) return undefined;
    this.expire(request);
    return structuredClone(request);
  }

  claimNext(installationId: string): BrowserInspectionRequest | undefined {
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
    result: { status: 'completed' | 'failed'; captureId?: string; extractionId?: string; error?: string },
  ): BrowserInspectionRequest {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('Browser inspection request not found');
    this.expire(request);
    if (request.status !== 'claimed') {
      throw new Error(`Browser inspection cannot complete from status ${request.status}`);
    }
    if (request.installationId !== installationId) {
      throw new Error('Browser inspection installation binding mismatch');
    }
    request.status = result.status;
    request.completedAt = new Date().toISOString();
    if (result.status === 'completed') {
      request.captureId = bounded(result.captureId, 'captureId', 200);
      request.extractionId = bounded(result.extractionId, 'extractionId', 200);
    } else {
      request.error = bounded(result.error || 'Browser inspection failed.', 'error', 1_000);
    }
    return structuredClone(request);
  }

  reset(): void {
    this.requests.clear();
  }

  private expire(request: BrowserInspectionRequest): void {
    if (
      ['queued', 'claimed'].includes(request.status)
      && Date.now() > new Date(request.expiresAt).getTime()
    ) request.status = 'expired';
  }
}

function bounded(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain between 1 and ${maxLength} characters`);
  }
  return normalized;
}

export const browserInspectionStore = new BrowserInspectionStore();
