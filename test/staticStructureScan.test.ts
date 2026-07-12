// test/staticStructureScan.test.ts
import { McpWorkspaceAdapter } from '../server/mcpAdapter';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

console.log('Running Static Structure Scan & Dependency Routing tests...');

const mockDir = path.resolve(__dirname, 'mock-files');

function setupMockFiles() {
  if (!fs.existsSync(mockDir)) {
    fs.mkdirSync(mockDir, { recursive: true });
  }

  // File A (TS) imports B, react, and defines classes & functions
  fs.writeFileSync(path.join(mockDir, 'a.ts'), `
import { bFunc } from './b';
import React from 'react';

export function aFunc() {
  return "hello";
}

export class AClass {
  constructor() {}
}

const arrowFunc = () => {
  console.log('arrow');
};
  `);

  // File B (TS) imports C (cyclic import path)
  fs.writeFileSync(path.join(mockDir, 'b.ts'), `
import { cFunc } from './c';
export function bFunc() {}
  `);

  // File C (TS) imports A (completes the cyclic loop a -> b -> c -> a) and imports a missing file
  fs.writeFileSync(path.join(mockDir, 'c.ts'), `
import { aFunc } from './a';
import { missingFunc } from './non-existent';
export function cFunc() {}
  `);

  // File D (Python) defines defs & classes
  fs.writeFileSync(path.join(mockDir, 'd.py'), `
import os
from sys import argv

def my_function():
    pass

class MyClass:
    pass

def _private_func():
    pass
  `);

  // File E (TSX) has components and path alias
  fs.writeFileSync(path.join(mockDir, 'e.tsx'), `
import { Button } from '@/components/Button';
export const MyComponent = () => {
  return <div />;
};
  `);

  // Denied file .env
  fs.writeFileSync(path.join(mockDir, '.env'), `
SECRET_KEY=supersecret
  `);
}

function cleanupMockFiles() {
  try {
    if (fs.existsSync(mockDir)) {
      fs.rmSync(mockDir, { recursive: true, force: true });
    }
  } catch {}
}

async function runTests() {
  setupMockFiles();

  const adapter = new McpWorkspaceAdapter('test-scan-ws', mockDir);

  try {
    // 1. Test TS analysis (imports, functions, classes)
    console.log('- Testing TS analysis...');
    const aRes = await adapter.call('workspace.analyzeStructure', { relativePath: 'a.ts' });
    const aData = JSON.parse(aRes.content[0].text);
    
    assert.strictEqual(aData.language, 'typescript');
    assert.ok(aData.imports.some((i: any) => i.source === './b' && i.kind === 'relative'));
    assert.ok(aData.imports.some((i: any) => i.source === 'react' && i.kind === 'package'));
    assert.ok(aData.functions.some((f: any) => f.name === 'aFunc' && f.exported === true));
    assert.ok(aData.functions.some((f: any) => f.name === 'arrowFunc' && f.exported === false));
    assert.ok(aData.classes.some((c: any) => c.name === 'AClass' && c.exported === true));

    // 2. Test Python analysis
    console.log('- Testing Python analysis...');
    const dRes = await adapter.call('workspace.analyzeStructure', { relativePath: 'd.py' });
    const dData = JSON.parse(dRes.content[0].text);
    assert.strictEqual(dData.language, 'python');
    assert.ok(dData.imports.some((i: any) => i.source === 'os' && i.kind === 'package'));
    assert.ok(dData.functions.some((f: any) => f.name === 'my_function' && f.exported === true));
    assert.ok(dData.functions.some((f: any) => f.name === '_private_func' && f.exported === false));
    assert.ok(dData.classes.some((c: any) => c.name === 'MyClass' && c.exported === true));

    // 3. Test TSX component detection
    console.log('- Testing TSX Component analysis...');
    const eRes = await adapter.call('workspace.analyzeStructure', { relativePath: 'e.tsx' });
    const eData = JSON.parse(eRes.content[0].text);
    assert.strictEqual(eData.language, 'typescript');
    assert.ok(eData.functions.some((f: any) => f.name === 'MyComponent' && f.exported === true));

    // 4. Test Dependency Map recursive traversal and cycle handling (a -> b -> c -> a)
    console.log('- Testing Dependency Mapping and cycle handling...');
    const mapRes = await adapter.call('workspace.mapDependencies', { entryPoint: 'a.ts', maxDepth: 3 });
    const mapData = JSON.parse(mapRes.content[0].text);
    
    assert.strictEqual(mapData.entryPoint, 'a.ts');
    assert.ok(mapData.nodes.some((n: any) => n.path === 'a.ts' && n.status === 'resolved'));
    assert.ok(mapData.nodes.some((n: any) => n.path === 'b.ts' && n.status === 'resolved'));
    assert.ok(mapData.nodes.some((n: any) => n.path === 'c.ts' && n.status === 'resolved'));
    assert.ok(mapData.nodes.some((n: any) => n.path === 'non-existent' && n.status === 'missing'));
    assert.ok(mapData.nodes.some((n: any) => n.path === 'react' && n.status === 'external'));

    // Check that loop didn't hang and cycle was marked resolved
    const cycleEdge = mapData.edges.find((e: any) => e.from === 'c.ts' && e.to === 'a.ts');
    assert.ok(cycleEdge, 'Should map the cyclic edge back to a.ts');

    // 5. Test alias import is classified as alias status
    console.log('- Testing Alias import classification...');
    const aliasRes = await adapter.call('workspace.mapDependencies', { entryPoint: 'e.tsx', maxDepth: 2 });
    const aliasData = JSON.parse(aliasRes.content[0].text);
    assert.ok(aliasData.nodes.some((n: any) => n.path === '@/components/Button' && n.status === 'alias'));

    // 6. Test Policy enforcement (reading or scanning .env file)
    console.log('- Testing Policy blocks scanning .env...');
    try {
      await adapter.call('workspace.analyzeStructure', { relativePath: '.env' });
      assert.fail('Should have blocked scan on .env');
    } catch (err: any) {
      assert.ok(err.message.includes('Access Denied'), 'Expected Access Denied for denied file scan');
    }

    try {
      await adapter.call('workspace.mapDependencies', { entryPoint: '.env' });
      assert.fail('Should have blocked dependency mapping starting from .env');
    } catch (err: any) {
      assert.ok(err.message.includes('Access Denied'), 'Expected Access Denied for denied file mapping');
    }

    // 7. Test missing file is marked missing, not throwing exception
    console.log('- Testing missing file gracefully reported...');
    const missingRes = await adapter.call('workspace.mapDependencies', { entryPoint: 'non-existent.ts' });
    const missingData = JSON.parse(missingRes.content[0].text);
    assert.ok(missingData.nodes.some((n: any) => n.path === 'non-existent.ts' && n.status === 'missing'));

    console.log('✓ All Static Structure Scan + Dependency map tests passed successfully!');
    cleanupMockFiles();
  } catch (err: any) {
    cleanupMockFiles();
    console.error('FAIL:', err);
    process.exit(1);
  }
}

runTests();
