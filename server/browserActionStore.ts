import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export type BrowserActionCapability = 'browser.click.execute' | 'browser.fill.execute' | 'browser.scroll.execute' | 'browser.select.execute';
export type BrowserActionPreviewStatus =
  | 'queued'
  | 'claimed'
  | 'previewed'
  | 'stale-target'
  | 'failed';
export type BrowserActionStatus =
  | 'proposed'
  | 'approved'
  | 'dispatched'
  | 'completed'
  | 'failed'
  | 'stale-target'
  | 'interrupted'
  | 'canceled'
  | 'expired';

export interface BrowserActionTarget {
  tabId: number;
  frameId: number;
  expectedOrigin: string;
  role: string;
  accessibleName: string;
  elementFingerprint: string;
}

export interface BrowserActionResult {
  status: 'completed' | 'failed' | 'stale-target';
  actualOrigin: string;
  elementFingerprint: string;
  url?: string;
  title?: string;
  message?: string;
  postActionCaptureId?: string;
}

export interface BrowserActionPreviewResult {
  status: 'previewed' | 'stale-target' | 'failed';
  actualOrigin: string;
  elementFingerprint: string;
  url?: string;
  title?: string;
  message?: string;
}

export interface BrowserAction {
  actionId: string;
  capability: BrowserActionCapability;
  installationId: string;
  status: BrowserActionStatus;
  riskLevel: 'interact';
  target: BrowserActionTarget;
  expectedOutcome: string;
  previewStatus: BrowserActionPreviewStatus;
  createdAt: string;
  expiresAt: string;
  previewClaimedAt?: string;
  previewedAt?: string;
  previewResult?: BrowserActionPreviewResult;
  approvedAt?: string;
  dispatchedAt?: string;
  completedAt?: string;
  interruptedAt?: string;
  interruptionReason?: string;
  result?: BrowserActionResult;
  /** Value to fill into text inputs (for browser.fill.execute). */
  fillValue?: string;
  /** Scroll direction (for browser.scroll.execute). */
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
}

export interface ClaimedBrowserAction {
  action: BrowserAction;
  dispatchToken: string;
}

export interface ClaimedBrowserActionPreview {
  action: BrowserAction;
  previewToken: string;
}

interface StoredBrowserAction extends BrowserAction {
  dispatchToken?: string;
  previewToken?: string;
}

interface PersistedBrowserActions {
  version: 1;
  actions: BrowserAction[];
}

const ACTION_TTL_MS = 2 * 60 * 1000;
const ALLOWED_ROLES = new Set(['button', 'link', 'checkbox', 'radio', 'tab', 'textbox', 'combobox', 'listbox', 'slider', 'menuitem']);

function cloneAction(action: StoredBrowserAction): BrowserAction {
  const {
    dispatchToken: _dispatchToken,
    previewToken: _previewToken,
    ...safeAction
  } = action;
  return structuredClone(safeAction);
}

function normalizeOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Browser actions require an HTTP or HTTPS origin');
  }
  if (parsed.origin !== value) {
    throw new Error('expectedOrigin must be an origin without a path');
  }
  return parsed.origin.toLowerCase();
}

function boundedText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${field} must contain between 1 and ${maxLength} characters`);
  }
  return normalized;
}

function sanitizeBrowserUrl(value: unknown, field: string): string {
  const parsed = new URL(boundedText(value, field, 2048));
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${field} must be an HTTP or HTTPS URL`);
  }
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  for (const key of [...parsed.searchParams.keys()]) {
    if (/(?:token|secret|password|key|auth|credential|code)/i.test(key)) {
      parsed.searchParams.set(key, '[redacted]');
    }
  }
  return parsed.toString();
}

function validateTarget(target: BrowserActionTarget): BrowserActionTarget {
  if (!Number.isInteger(target?.tabId) || target.tabId < 0) {
    throw new Error('target.tabId must be a non-negative integer');
  }
  if (!Number.isInteger(target?.frameId) || target.frameId !== 0) {
    throw new Error('Only the top-level browser frame is supported in this milestone');
  }

  const role = boundedText(target.role, 'target.role', 32).toLowerCase();
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(`Unsupported target role: ${role}`);
  }

  const fingerprint = boundedText(
    target.elementFingerprint,
    'target.elementFingerprint',
    160,
  );
  if (!/^[a-zA-Z0-9:_-]+$/.test(fingerprint)) {
    throw new Error('target.elementFingerprint contains unsupported characters');
  }

  return {
    tabId: target.tabId,
    frameId: 0,
    expectedOrigin: normalizeOrigin(target.expectedOrigin),
    role,
    accessibleName: boundedText(target.accessibleName, 'target.accessibleName', 200),
    elementFingerprint: fingerprint,
  };
}

export class BrowserActionStore {
  private readonly actions = new Map<string, StoredBrowserAction>();
  private readonly filePath: string | null;
  private readonly listeners = new Set<(action: BrowserAction) => void>();

  constructor(root: string | null = null) {
    if (!root) {
      this.filePath = null;
      return;
    }
    const directory = path.join(root, 'browser');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.filePath = path.join(directory, 'actions.json');
    this.load();
    this.reconcileAfterRestart();
  }

  propose(input: {
    installationId: string;
    capability: BrowserActionCapability;
    target: BrowserActionTarget;
    expectedOutcome: string;
    fillValue?: string;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
  }): BrowserAction {
    if (!['browser.click.execute', 'browser.fill.execute', 'browser.scroll.execute', 'browser.select.execute'].includes(input.capability)) {
      throw new Error('Only browser.click.execute, browser.fill.execute, browser.scroll.execute, and browser.select.execute are supported');
    }

    const now = new Date();
    const action: StoredBrowserAction = {
      actionId: `browser-action-${randomUUID()}`,
      capability: input.capability,
      installationId: boundedText(input.installationId, 'installationId', 200),
      status: 'proposed',
      riskLevel: 'interact',
      target: validateTarget(input.target),
      expectedOutcome: boundedText(input.expectedOutcome, 'expectedOutcome', 500),
      previewStatus: 'queued',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ACTION_TTL_MS).toISOString(),
      fillValue: input.fillValue ? boundedText(input.fillValue, 'fillValue', 5000) : undefined,
      scrollDirection: input.scrollDirection,
    };
    this.actions.set(action.actionId, action);
    this.persist();
    return cloneAction(action);
  }

  get(actionId: string): BrowserAction | undefined {
    const action = this.actions.get(actionId);
    if (!action) return undefined;
    if (this.expireIfNeeded(action)) this.persist();
    return cloneAction(action);
  }

  approve(actionId: string): BrowserAction {
    const action = this.requireAction(actionId);
    if (this.expireIfNeeded(action)) this.persist();
    if (action.status !== 'proposed') {
      throw new Error(`Action cannot be approved from status ${action.status}`);
    }
    if (action.previewStatus !== 'previewed') {
      throw new Error(`Action cannot be approved before target preview succeeds`);
    }
    action.status = 'approved';
    action.approvedAt = new Date().toISOString();
    this.persist();
    return cloneAction(action);
  }

  cancel(actionId: string): BrowserAction {
    const action = this.requireAction(actionId);
    if (this.expireIfNeeded(action)) this.persist();
    if (!['proposed', 'approved'].includes(action.status)) {
      throw new Error(`Action cannot be canceled from status ${action.status}`);
    }
    action.status = 'canceled';
    this.persist();
    return cloneAction(action);
  }

  claimNext(installationId: string): ClaimedBrowserAction | undefined {
    let changed = false;
    for (const action of this.actions.values()) {
      changed = this.expireIfNeeded(action) || changed;
      if (action.installationId !== installationId || action.status !== 'approved') {
        continue;
      }
      action.status = 'dispatched';
      action.dispatchedAt = new Date().toISOString();
      action.dispatchToken = randomUUID();
      this.persist();
      return {
        action: cloneAction(action),
        dispatchToken: action.dispatchToken,
      };
    }
    if (changed) this.persist();
    return undefined;
  }

  claimNextPreview(installationId: string): ClaimedBrowserActionPreview | undefined {
    let changed = false;
    for (const action of this.actions.values()) {
      changed = this.expireIfNeeded(action) || changed;
      if (
        action.installationId !== installationId
        || action.status !== 'proposed'
        || action.previewStatus !== 'queued'
      ) {
        continue;
      }
      action.previewStatus = 'claimed';
      action.previewClaimedAt = new Date().toISOString();
      action.previewToken = randomUUID();
      this.persist();
      return {
        action: cloneAction(action),
        previewToken: action.previewToken,
      };
    }
    if (changed) this.persist();
    return undefined;
  }

  completePreview(
    actionId: string,
    installationId: string,
    previewToken: string,
    result: BrowserActionPreviewResult,
  ): BrowserAction {
    const action = this.requireAction(actionId);
    if (action.status !== 'proposed' || action.previewStatus !== 'claimed') {
      throw new Error(
        `Action preview cannot be accepted from ${action.status}/${action.previewStatus}`,
      );
    }
    if (action.installationId !== installationId) {
      throw new Error('Action preview installation binding mismatch');
    }
    if (!previewToken || previewToken !== action.previewToken) {
      throw new Error('Invalid or already-consumed preview token');
    }
    if (!['previewed', 'stale-target', 'failed'].includes(result.status)) {
      throw new Error('Unsupported browser action preview status');
    }

    const actualOrigin = normalizeOrigin(result.actualOrigin);
    const fingerprint = boundedText(
      result.elementFingerprint,
      'previewResult.elementFingerprint',
      160,
    );
    const normalizedResult: BrowserActionPreviewResult = {
      status: result.status,
      actualOrigin,
      elementFingerprint: fingerprint,
      url: result.url ? sanitizeBrowserUrl(result.url, 'previewResult.url') : undefined,
      title: result.title ? boundedText(result.title, 'previewResult.title', 500) : undefined,
      message: result.message
        ? boundedText(result.message, 'previewResult.message', 1000)
        : undefined,
    };
    if (
      actualOrigin !== action.target.expectedOrigin
      || fingerprint !== action.target.elementFingerprint
    ) {
      normalizedResult.status = 'stale-target';
      normalizedResult.message =
        normalizedResult.message || 'The browser target changed before preview.';
    }

    action.previewResult = normalizedResult;
    action.previewStatus = normalizedResult.status;
    if (normalizedResult.status === 'previewed') {
      action.previewedAt = new Date().toISOString();
    }
    delete action.previewToken;
    this.persist();
    const safeAction = cloneAction(action);
    this.emit(safeAction);
    return safeAction;
  }

  subscribe(listener: (action: BrowserAction) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  complete(
    actionId: string,
    installationId: string,
    dispatchToken: string,
    result: BrowserActionResult,
  ): BrowserAction {
    const action = this.requireAction(actionId);
    if (action.status !== 'dispatched') {
      throw new Error(`Action result cannot be accepted from status ${action.status}`);
    }
    if (action.installationId !== installationId) {
      throw new Error('Action installation binding mismatch');
    }
    if (!dispatchToken || dispatchToken !== action.dispatchToken) {
      throw new Error('Invalid or already-consumed dispatch token');
    }
    if (!['completed', 'failed', 'stale-target'].includes(result.status)) {
      throw new Error('Unsupported browser action result status');
    }

    const actualOrigin = normalizeOrigin(result.actualOrigin);
    const fingerprint = boundedText(
      result.elementFingerprint,
      'result.elementFingerprint',
      160,
    );
    const normalizedResult: BrowserActionResult = {
      status: result.status,
      actualOrigin,
      elementFingerprint: fingerprint,
      url: result.url ? sanitizeBrowserUrl(result.url, 'result.url') : undefined,
      title: result.title ? boundedText(result.title, 'result.title', 500) : undefined,
      message: result.message ? boundedText(result.message, 'result.message', 1000) : undefined,
      postActionCaptureId: result.postActionCaptureId
        ? boundedText(result.postActionCaptureId, 'result.postActionCaptureId', 200)
        : undefined,
    };

    if (
      actualOrigin !== action.target.expectedOrigin ||
      fingerprint !== action.target.elementFingerprint
    ) {
      normalizedResult.status = 'stale-target';
      normalizedResult.message =
        normalizedResult.message || 'The browser target changed before execution completed.';
    }

    action.result = normalizedResult;
    action.status = normalizedResult.status;
    action.completedAt = new Date().toISOString();
    delete action.dispatchToken;
    this.persist();
    return cloneAction(action);
  }

  reset(): void {
    this.actions.clear();
    if (this.filePath) {
      try {
        fs.unlinkSync(this.filePath);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  private requireAction(actionId: string): StoredBrowserAction {
    const action = this.actions.get(actionId);
    if (!action) throw new Error('Browser action not found');
    return action;
  }

  private expireIfNeeded(action: StoredBrowserAction): boolean {
    if (
      ['proposed', 'approved'].includes(action.status) &&
      Date.now() > new Date(action.expiresAt).getTime()
    ) {
      action.status = 'expired';
      return true;
    }
    return false;
  }

  private load(): void {
    if (!this.filePath) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as PersistedBrowserActions;
      if (parsed.version !== 1 || !Array.isArray(parsed.actions)) return;
      for (const action of parsed.actions) {
        if (!action?.actionId || !action.installationId || !action.target) continue;
        this.actions.set(action.actionId, structuredClone(action));
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(
          '[BrowserActionStore] Could not load persisted browser actions:',
          (error as Error).message,
        );
      }
    }
  }

  private reconcileAfterRestart(): void {
    let changed = false;
    for (const action of this.actions.values()) {
      if (action.dispatchToken) {
        delete action.dispatchToken;
        changed = true;
      }
      if (!action.previewStatus) {
        action.previewStatus = 'queued';
        changed = true;
      }
      if (action.previewToken) {
        delete action.previewToken;
        changed = true;
      }
      if (action.status === 'proposed' && action.previewStatus !== 'queued') {
        action.previewStatus = 'queued';
        action.previewClaimedAt = undefined;
        action.previewedAt = undefined;
        action.previewResult = undefined;
        changed = true;
      }
      if (action.status === 'approved' || action.status === 'dispatched') {
        action.status = 'interrupted';
        action.interruptedAt = new Date().toISOString();
        action.interruptionReason =
          'PaneTera restarted after approval. The action will not be dispatched or repeated.';
        changed = true;
        continue;
      }
      changed = this.expireIfNeeded(action) || changed;
    }
    if (changed) this.persist();
  }

  private persist(): void {
    if (!this.filePath) return;
    const snapshot: PersistedBrowserActions = {
      version: 1,
      actions: [...this.actions.values()].map(cloneAction),
    };
    const temporary = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(temporary, this.filePath);
  }

  private emit(action: BrowserAction): void {
    for (const listener of this.listeners) {
      try {
        listener(structuredClone(action));
      } catch {
        // Preview observers cannot break action persistence.
      }
    }
  }
}

export let browserActionStore = new BrowserActionStore();

export function configureBrowserActionStore(store: BrowserActionStore): void {
  browserActionStore = store;
}
