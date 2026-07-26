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

const FALLBACK_MODELS: ModelDescriptor[] = [
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini', description: 'Fast and affordable', cost: 'low', capabilities: ['text', 'tools'] },
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o', description: 'Balanced performance and cost', cost: 'medium', capabilities: ['text', 'vision', 'tools'] },
  { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', description: 'Most capable OpenAI model', cost: 'high', capabilities: ['text', 'vision', 'tools'] },
  { id: 'o4-mini', provider: 'openai', name: 'o4-mini', description: 'Reasoning model for complex tasks', cost: 'medium', capabilities: ['text', 'reasoning', 'tools'] },
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', name: 'Claude Sonnet 4', description: 'Best balance of speed and intelligence', cost: 'medium', capabilities: ['text', 'vision', 'tools'] },
  { id: 'claude-haiku-35-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', description: 'Fast and cost-effective', cost: 'low', capabilities: ['text', 'vision', 'tools'] },
  { id: 'gemini-2.5-flash', provider: 'google', name: 'Gemini 2.5 Flash', description: 'Fast with strong reasoning', cost: 'low', capabilities: ['text', 'vision', 'tools'] },
  { id: 'gemini-2.5-pro', provider: 'google', name: 'Gemini 2.5 Pro', description: 'Most capable Google model', cost: 'medium', capabilities: ['text', 'vision', 'tools', 'reasoning'] },
  { id: 'ollama:llama3.2', provider: 'ollama', name: 'Llama 3.2 (Local)', description: 'Free local model via Ollama', cost: 'low', capabilities: ['text', 'tools'] },
  { id: 'ollama:codellama', provider: 'ollama', name: 'CodeLlama (Local)', description: 'Free local code model via Ollama', cost: 'low', capabilities: ['text', 'code'] },
];

export function useModelSelection() {
  const [models, setModels] = useState<ModelDescriptor[]>(FALLBACK_MODELS);
  const [activeModel, setActiveModel] = useState<ModelDescriptor | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as ModelDescriptor;
      } catch {
        // ignore
      }
    }
    return FALLBACK_MODELS.find((m) => m.id === DEFAULT_MODEL_ID) || FALLBACK_MODELS[0];
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        const serverModels: ModelDescriptor[] = data.models || [];
        if (serverModels.length > 0) {
          setModels(serverModels);
          setActiveModel((prev) => {
            if (prev) return prev;
            const defaultModel = serverModels.find((m) => m.id === DEFAULT_MODEL_ID) || serverModels[0];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultModel));
            return defaultModel;
          });
        }
      })
      .catch(() => {
        // Fallback models are already the initial state — no-op
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
