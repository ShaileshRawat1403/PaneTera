// chrome-extension/operator/mode.js
//
// Governance mode toggle for the browser operator.
//
// PaneTera's default is a governed operator: every consequential action routes
// through propose -> preview -> approve -> execute with provenance and audit.
// The user may explicitly switch to an ungoverned "full operator" mode, which
// executes navigation, scripting, coordinate input, and diagnostics directly
// with no approval gate. The mode is persisted so it survives service-worker
// restarts, and every read is explicit so no code path can assume ungoverned
// authority by default.
//
// chromeApi is injected so this module is unit-testable without a browser.

export const OPERATOR_MODE_KEY = 'operatorMode';
export const GOVERNED = 'governed';
export const UNGOVERNED = 'ungoverned';

const VALID_MODES = new Set([GOVERNED, UNGOVERNED]);

/**
 * Read the persisted operator mode. Any missing, corrupt, or unknown value
 * resolves to GOVERNED. Ungoverned authority is never the fallback.
 * @param {typeof chrome} chromeApi
 * @returns {Promise<'governed'|'ungoverned'>}
 */
export async function getMode(chromeApi) {
  try {
    const stored = await chromeApi.storage.local.get(OPERATOR_MODE_KEY);
    const value = stored?.[OPERATOR_MODE_KEY];
    return VALID_MODES.has(value) ? value : GOVERNED;
  } catch {
    return GOVERNED;
  }
}

/**
 * Persist the operator mode. Rejects unknown values so the store can only ever
 * hold a known-safe mode.
 * @param {typeof chrome} chromeApi
 * @param {'governed'|'ungoverned'} mode
 * @returns {Promise<'governed'|'ungoverned'>}
 */
export async function setMode(chromeApi, mode) {
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Unknown operator mode: ${String(mode)}`);
  }
  await chromeApi.storage.local.set({ [OPERATOR_MODE_KEY]: mode });
  return mode;
}

/**
 * Convenience predicate. True only when the persisted mode is explicitly
 * ungoverned.
 * @param {typeof chrome} chromeApi
 * @returns {Promise<boolean>}
 */
export async function isUngoverned(chromeApi) {
  return (await getMode(chromeApi)) === UNGOVERNED;
}

/**
 * Flip between modes and return the new mode.
 * @param {typeof chrome} chromeApi
 */
export async function toggleMode(chromeApi) {
  const next = (await getMode(chromeApi)) === UNGOVERNED ? GOVERNED : UNGOVERNED;
  return setMode(chromeApi, next);
}
