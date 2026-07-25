process.env.NODE_ENV = 'test';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceGraphResolver } from '../server/tessera/evidenceResolver';
import { ResearchSessionModal } from '../src/components/workstation/ResearchSessionModal';

describe('Tessera Phase 2B Evidence & Provenance Graph unit tests', () => {
  const resolver = new EvidenceGraphResolver();

  it('creates a research session and attaches evidence items with SHA-256 digests', () => {
    const session = resolver.createSession('API Deprecation Audit', 'flowright');
    assert.strictEqual(session.title, 'API Deprecation Audit');
    assert.ok(session.sessionId.startsWith('session_'));

    const webItem = resolver.addEvidence(session.sessionId, {
      sourceType: 'browser-evidence',
      title: 'GitHub API Docs',
      urlOrPath: 'https://docs.github.com',
      snippet: 'OAuth query params are not supported',
    });

    assert.strictEqual(webItem.sourceType, 'browser-evidence');
    assert.ok(webItem.contentHash.length === 64);

    const wsItem = resolver.addEvidence(session.sessionId, {
      sourceType: 'workspace-evidence',
      title: 'Client Code',
      urlOrPath: 'src/api.ts',
      snippet: 'OAuth query params access_token active',
    });

    assert.strictEqual(wsItem.sourceType, 'workspace-evidence');
    assert.strictEqual(session.evidenceItems.length, 2);
  });

  it('detects conflicting claims between web evidence and workspace code', () => {
    const session = resolver.createSession('Conflict Test');
    resolver.addEvidence(session.sessionId, {
      sourceType: 'browser-evidence',
      title: 'Web Spec',
      urlOrPath: 'https://spec.org',
      snippet: 'Param is not active and deprecated',
    });
    resolver.addEvidence(session.sessionId, {
      sourceType: 'workspace-evidence',
      title: 'Code File',
      urlOrPath: 'src/main.ts',
      snippet: 'Param is active in production',
    });

    const claims = resolver.detectConflictingClaims(session);
    assert.ok(claims.length >= 1);
    assert.strictEqual(claims[0].status, 'conflicting');
  });

  it('synthesizes provenance-backed analysis report with verified references', () => {
    const session = resolver.createSession('Synthesis Test');
    resolver.addEvidence(session.sessionId, {
      sourceType: 'browser-evidence',
      title: 'Doc',
      urlOrPath: 'https://doc.com',
      snippet: 'Valid snippet text',
    });

    const analysis = resolver.synthesizeAnalysis(session.sessionId);
    assert.ok(analysis.analysisId.startsWith('analysis_'));
    assert.ok(analysis.synthesizedMarkdown.includes('# Research Analysis Report'));
    assert.ok(analysis.synthesizedMarkdown.includes('Valid snippet text') || analysis.synthesizedMarkdown.includes('Doc'));
    assert.ok(analysis.contentHash.length === 64);
  });

  it('renders ResearchSessionModal correctly', () => {
    const html = renderToStaticMarkup(
      <ResearchSessionModal open={true} onClose={() => {}} />
    );

    assert.ok(html.includes('Research Session &amp; Evidence Graph') || html.includes('Research Session & Evidence Graph'));
    assert.ok(html.includes('Tessera Phase 2B'));
    assert.ok(html.includes('CLAIM COMPARISON &amp; CONFLICT DETECTION') || html.includes('CLAIM COMPARISON & CONFLICT DETECTION'));
  });
});
