import { useState, useEffect, useCallback } from 'react';

export interface ModelDescriptor {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  name: string;
  description: string;
  cost: 'low' | 'medium' | 'high';
  capabilities: string[];
}

const STORAGE_KEY = 'panetera-active-model';
const DEFAULT_MODEL_ID = 'gpt-4o-mini';

export function useModelSelection() {
  const [models, setModels] = useState<ModelDescriptor[]>([]);
  const [activeModel, setActiveModel] = useState<ModelDescriptor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ModelDescriptor;
        setActiveModel(parsed);
      } catch {
        // ignore
      }
    }

    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        setModels(data.models || []);
        if (!activeModel && data.models?.length) {
          const defaultModel = data.models.find((m: ModelDescriptor) => m.id === DEFAULT_MODEL_ID) || data.models[0];
          setActiveModel(defaultModel);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultModel));
        }
      })
      .catch(() => {
        // Use fallback models if API unavailable
        setModels([
          { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', description: 'Fast and affordable', cost: 'low', capabilities: ['text', 'tools'] },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectModel = useCallback(async (model: ModelDescriptor) => {
    setActiveModel(model);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));

    try {
      await fetch('/api/models/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: model.id }),
      });
    } catch {
      // Best effort - local state is already updated
    }
  }, []);

  return { models, activeModel, selectModel, loading };
}
