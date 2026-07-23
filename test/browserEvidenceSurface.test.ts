import assert from 'node:assert';
import { describe, it } from 'node:test';
import { browserEvidenceViewModel } from '../src/components/workbench/browserEvidenceSurfaceModel';

describe('browser evidence canvas model', () => {
  it('renders article evidence with observed provenance', () => {
    const model = browserEvidenceViewModel({
      extractionId: 'extract-1',
      capability: 'browser.article.extract',
      source: {
        title: 'Observed title',
        url: 'https://example.com/redirected',
        capturedAt: '2026-07-21T12:00:00.000Z',
      },
      data: { textContent: 'Readable evidence', excerpt: 'Excerpt' },
      evidence: { elementsMatched: 1, contentBytes: 17 },
    });

    assert.strictEqual(model.title, 'Observed title');
    assert.strictEqual(model.url, 'https://example.com/redirected');
    assert.strictEqual(model.text, 'Readable evidence');
    assert.strictEqual(model.capability, 'browser.article.extract');
  });

  it('bounds visible evidence instead of dumping the extraction', () => {
    const model = browserEvidenceViewModel({ data: { textContent: 'x'.repeat(100_000) } });
    assert.ok(model.text.length < 41_000);
    assert.match(model.text, /Evidence truncated for display/);
    assert.strictEqual(model.truncated, true);
  });

  it('accepts only bounded image data URLs', () => {
    const valid = browserEvidenceViewModel({
      data: { screenshotDataUrl: 'data:image/png;base64,AAAA' },
    });
    assert.strictEqual(valid.screenshotDataUrl, 'data:image/png;base64,AAAA');

    const unsafe = browserEvidenceViewModel({
      data: { screenshotDataUrl: 'javascript:alert(1)' },
    });
    assert.strictEqual(unsafe.screenshotDataUrl, null);
  });

  it('supports the smaller page-observation record without inventing data', () => {
    const model = browserEvidenceViewModel({
      captureId: 'capture-1',
      title: 'Selection',
      url: 'https://example.com/',
      selectedText: 'Explicitly selected text',
      capturedAt: '2026-07-21T12:00:00.000Z',
    });
    assert.strictEqual(model.text, 'Explicitly selected text');
    assert.strictEqual(model.screenshotDataUrl, null);
  });

  it('exposes the provenance facts the scannable surface needs', () => {
    const model = browserEvidenceViewModel({
      captureId: 'capture-abc',
      capability: 'browser.article.extract',
      source: { title: 'T', url: 'https://example.com/', capturedAt: '2026-07-21T12:00:00.000Z' },
      data: { textContent: 'body' },
      evidence: { elementsMatched: 4, contentBytes: 2048 },
    });

    assert.strictEqual(model.elementsMatched, 4);
    assert.strictEqual(model.contentBytes, 2048);
    assert.strictEqual(model.evidenceId, 'capture-abc');
    assert.strictEqual(model.evidenceIdKind, 'capture');
  });

  it('labels the extraction id as an extraction, not a capture', () => {
    // The id kind travels with the value so the surface can name it truthfully
    // rather than calling every id a capture id.
    const model = browserEvidenceViewModel({ extractionId: 'extract-9', data: { textContent: 'x' } });
    assert.strictEqual(model.evidenceId, 'extract-9');
    assert.strictEqual(model.evidenceIdKind, 'extraction');
  });

  it('prefers the capture id when both are present', () => {
    const model = browserEvidenceViewModel({
      captureId: 'capture-1',
      extractionId: 'extract-1',
      data: { textContent: 'x' },
    });
    assert.strictEqual(model.evidenceId, 'capture-1');
    assert.strictEqual(model.evidenceIdKind, 'capture');
  });

  it('reports absent provenance as null rather than a misleading zero', () => {
    // A missing byte count is not zero bytes, and a missing match count is not
    // zero matches. The surface hides a null fact rather than printing a
    // confident zero the capture never claimed.
    const model = browserEvidenceViewModel({ data: { textContent: 'x' } });
    assert.strictEqual(model.contentBytes, null);
    assert.strictEqual(model.elementsMatched, null);
    assert.strictEqual(model.evidenceId, null);
    assert.strictEqual(model.evidenceIdKind, null);
  });

  it('redacts sensitive query values and credentials from the shown address', () => {
    // The P1 defect: the surface must not put back the secrets the evidence
    // pipeline strips. The parameter name is kept so a person sees a secret was
    // there; the value is not.
    const model = browserEvidenceViewModel({
      source: { url: 'https://example.com/p?token=abc123&q=news&session=xyz', title: 'T' },
      data: { textContent: 'x' },
    });
    assert.ok(!/abc123/.test(model.url), 'the token value must not appear');
    assert.ok(!/xyz/.test(model.url), 'the session value must not appear');
    assert.match(model.url, /token=redacted/, 'the parameter name is kept, the value redacted');
    assert.match(model.url, /q=news/, 'a non-sensitive parameter is preserved');
  });

  it('strips embedded credentials from the shown address', () => {
    const model = browserEvidenceViewModel({
      source: { url: 'https://user:secretpass@example.com/p', title: 'T' },
      data: { textContent: 'x' },
    });
    assert.ok(!/secretpass/.test(model.url), 'embedded credentials must not appear');
  });

  it('matches sensitive params by substring, like the server sanitiser', () => {
    // The alignment fix: exact matching was weaker than the authoritative
    // server policy, which uses `.includes`. A prefixed or suffixed name such
    // as `x-access-token` or `apiKey` must still be caught.
    const model = browserEvidenceViewModel({
      source: {
        url: 'https://example.com/p?x-access-token=AAA&apiKey=BBB&user_session_id=CCC&q=ok',
        title: 'T',
      },
      data: { textContent: 'x' },
    });
    assert.ok(!/AAA|BBB|CCC/.test(model.url), 'substring-sensitive values must all be redacted');
    assert.match(model.url, /q=ok/, 'a genuinely non-sensitive parameter is preserved');
  });

  it('rejects a negative or non-finite byte count', () => {
    assert.strictEqual(
      browserEvidenceViewModel({ evidence: { contentBytes: -5 }, data: {} }).contentBytes,
      null,
    );
    assert.strictEqual(
      browserEvidenceViewModel({
        evidence: { contentBytes: Number.POSITIVE_INFINITY },
        data: {},
      }).contentBytes,
      null,
    );
  });
});
