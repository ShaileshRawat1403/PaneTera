// chrome-extension/test/operator-mode.test.js
import assert from 'node:assert';
import {
  getMode, setMode, toggleMode, isUngoverned,
  GOVERNED, UNGOVERNED, OPERATOR_MODE_KEY,
} from '../operator/mode.js';

console.log('Running operator-mode tests...');

function makeChrome() {
  const store = {};
  return {
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: store[key] } : {}),
        set: async (obj) => { Object.assign(store, obj); },
      },
    },
    _store: store,
  };
}

// Default is governed, never ungoverned.
{
  const chrome = makeChrome();
  assert.strictEqual(await getMode(chrome), GOVERNED, 'missing value must default governed');
  assert.strictEqual(await isUngoverned(chrome), false);
}

// Corrupt / unknown stored value falls back to governed.
{
  const chrome = makeChrome();
  chrome._store[OPERATOR_MODE_KEY] = 'chaos';
  assert.strictEqual(await getMode(chrome), GOVERNED, 'unknown value must default governed');
}

// setMode persists a valid mode and round-trips.
{
  const chrome = makeChrome();
  const returned = await setMode(chrome, UNGOVERNED);
  assert.strictEqual(returned, UNGOVERNED);
  assert.strictEqual(await getMode(chrome), UNGOVERNED);
  assert.strictEqual(await isUngoverned(chrome), true);
}

// setMode rejects unknown modes so the store can never hold an unsafe value.
{
  const chrome = makeChrome();
  await assert.rejects(() => setMode(chrome, 'ungovern-everything'), /Unknown operator mode/);
  assert.strictEqual(await getMode(chrome), GOVERNED);
}

// toggleMode flips both directions.
{
  const chrome = makeChrome();
  assert.strictEqual(await toggleMode(chrome), UNGOVERNED);
  assert.strictEqual(await toggleMode(chrome), GOVERNED);
}

// A failing storage read degrades to governed, not ungoverned.
{
  const chrome = { storage: { local: { get: async () => { throw new Error('storage down'); } } } };
  assert.strictEqual(await getMode(chrome), GOVERNED, 'storage failure must default governed');
}

console.log('operator-mode tests passed.');
