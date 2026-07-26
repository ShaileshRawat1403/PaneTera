// src/hooks/useIntentClassifier.ts
//
// Client-side intent classification fallback. When the deterministic matcher
// falls through to 'converse', this hook can optionally call the server-side
// classifier to get a better intent family.

import { useCallback, useRef } from 'react';

type IntentFamily = 'converse' | 'project' | 'web-surface' | 'live-app' | 'artifact' | 'run' | 'proposal' | 'rig' | 'headroom' | 'evidence';

interface ClassificationResult {
  family: IntentFamily;
  confidence: number;
}

const CONFIDENCE_THRESHOLD = 0.7;

export function useIntentClassifier() {
  const abortRef = useRef<AbortController | null>(null);

  const classify = useCallback(async (query: string): Promise<ClassificationResult | null> => {
    // Cancel any in-flight classification
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch('/api/classify-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      if (!resp.ok) return null;
      const data = await resp.json();

      if (data.confidence >= CONFIDENCE_THRESHOLD && data.family !== 'converse') {
        return { family: data.family, confidence: data.confidence };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  return { classify };
}
