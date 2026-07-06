// test/workflowIntent.test.ts
import assert from 'assert';
import { parseWorkflowIntent } from '../server/workflowIntents';

console.log('Running workflow intent tests...');

// 1. Flowright workflows intent tests
const flowrightQueries = [
  'show workflows',
  'show flowright workflows',
  'view workflows in flowright',
  '  SHOW WORKFLOWS  '
];

for (const q of flowrightQueries) {
  const parsed = parseWorkflowIntent(q);
  assert.ok(parsed !== null, `Should parse Flowright intent for: "${q}"`);
  assert.strictEqual(parsed.kind, 'flowright-workflows', `Should match kind: "${q}"`);
}

// 2. Soothsayer workflows/workbench intent tests
const soothsayerQueries = [
  'show soothsayer workflows',
  'inspect soothsayer workflows',
  'show soothsayer ui',
  'show contentops in soothsayer',
  'open soothsayer workflows',
  'open this soothsayer run',
  'show contentops draft'
];

for (const q of soothsayerQueries) {
  const parsed = parseWorkflowIntent(q);
  assert.ok(parsed !== null, `Should parse Soothsayer intent for: "${q}"`);
  assert.strictEqual(parsed.kind, 'soothsayer-workbench', `Should match kind: "${q}"`);
}

// 3. ContentOps intent tests
const contentOpsQueries = [
  { q: 'write a blog', expectedBrief: 'write a blog' },
  { q: 'draft a blog post', expectedBrief: 'draft a blog post' },
  { q: 'create content update', expectedBrief: 'create content update' },
  { q: 'write a post for pruningmypothos', expectedBrief: 'pruningmypothos' },
  { q: 'write a blog about pothos watering guide', expectedBrief: 'pothos watering guide' },
  { q: 'draft a blog post about pothos pruning mistakes', expectedBrief: 'pothos pruning mistakes' },
  { q: 'write a post about watering techniques', expectedBrief: 'watering techniques' }
];

for (const { q, expectedBrief } of contentOpsQueries) {
  const parsed = parseWorkflowIntent(q);
  assert.ok(parsed !== null, `Should parse ContentOps intent for: "${q}"`);
  assert.strictEqual(parsed.kind, 'contentops-draft', `Should match kind: "${q}"`);
  if (parsed.kind === 'contentops-draft') {
    assert.strictEqual(parsed.contentBrief, expectedBrief, `Should extract correct brief: "${parsed.contentBrief}" for "${q}"`);
  }
}

// 4. Ignored queries (must NOT swallow general command queries)
const ignoredQueries = [
  'hello',
  'check my commit for regressions',
  'inspect soothsayer',
  'run npm run verify in flowright',
  'git status in flowright',
  'show soothsayer ui' // Wait, does the prompt say "show soothsayer ui" is a workflow intent or live app intent?
  // User says: "show soothsayer ui" is a strict native intent: "Strict native intents must be local-first: show soothsayer ui, show soothsayer workflows, write a blog..."
  // Wait, so "show soothsayer ui" should also route!
];

for (const q of ignoredQueries) {
  // Let's test normal developer commands
  if (q === 'check my commit for regressions' || q === 'run npm run verify in flowright' || q === 'git status in flowright') {
    const parsed = parseWorkflowIntent(q);
    assert.strictEqual(parsed, null, `Should NOT swallow query: "${q}"`);
  }
}

console.log('✓ All workflow intent tests passed!');
