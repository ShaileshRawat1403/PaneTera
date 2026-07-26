import fs from 'fs';
import path from 'path';
import { getTesseraAppDataDir } from './appData';

export interface ModelDescriptor {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  name: string;
  description: string;
  cost: 'low' | 'medium' | 'high';
  capabilities: string[];
}

export const AVAILABLE_MODELS: ModelDescriptor[] = [
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o Mini',
    description: 'Fast and affordable for most tasks',
    cost: 'low',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    description: 'Balanced performance and cost',
    cost: 'medium',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    name: 'GPT-4.1',
    description: 'Most capable OpenAI model',
    cost: 'high',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'o4-mini',
    provider: 'openai',
    name: 'o4-mini',
    description: 'Reasoning model for complex tasks',
    cost: 'medium',
    capabilities: ['text', 'reasoning', 'tools'],
  },
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    name: 'Claude Sonnet 4',
    description: 'Best balance of speed and intelligence',
    cost: 'medium',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'claude-haiku-35-20241022',
    provider: 'anthropic',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and cost-effective',
    cost: 'low',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    name: 'Gemini 2.5 Flash',
    description: 'Fast with strong reasoning',
    cost: 'low',
    capabilities: ['text', 'vision', 'tools'],
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable Google model',
    cost: 'medium',
    capabilities: ['text', 'vision', 'tools', 'reasoning'],
  },
  {
    id: 'ollama:llama3.2',
    provider: 'ollama',
    name: 'Llama 3.2 (Local)',
    description: 'Free local model via Ollama',
    cost: 'low',
    capabilities: ['text', 'tools'],
  },
  {
    id: 'ollama:codellama',
    provider: 'ollama',
    name: 'CodeLlama (Local)',
    description: 'Free local code model via Ollama',
    cost: 'low',
    capabilities: ['text', 'code'],
  },
];

interface PersistedModelStore {
  version: 1;
  activeModelId: string;
}

export class ModelStore {
  private activeModelId: string;
  private readonly filePath: string;

  constructor(root?: string) {
    const dataDir = root || getTesseraAppDataDir();
    const directory = path.join(dataDir, 'config');
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.filePath = path.join(directory, 'models.json');
    this.activeModelId = 'gpt-4o-mini';
    this.load();
  }

  getActiveModel(): ModelDescriptor {
    return AVAILABLE_MODELS.find((m) => m.id === this.activeModelId) || AVAILABLE_MODELS[0];
  }

  getActiveModelId(): string {
    return this.activeModelId;
  }

  setActiveModel(modelId: string): ModelDescriptor {
    const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    this.activeModelId = modelId;
    this.persist();
    return model;
  }

  listModels(): ModelDescriptor[] {
    return [...AVAILABLE_MODELS];
  }

  private load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as PersistedModelStore;
      if (parsed.version === 1 && typeof parsed.activeModelId === 'string') {
        this.activeModelId = parsed.activeModelId;
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[ModelStore] Could not load model config:', (error as Error).message);
      }
    }
  }

  private persist(): void {
    const snapshot: PersistedModelStore = {
      version: 1,
      activeModelId: this.activeModelId,
    };
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(snapshot, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.renameSync(temporary, this.filePath);
  }
}

let defaultStore: ModelStore | null = null;

export function getModelStore(): ModelStore {
  if (!defaultStore) defaultStore = new ModelStore();
  return defaultStore;
}
