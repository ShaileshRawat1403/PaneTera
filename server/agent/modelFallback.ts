// server/agent/modelFallback.ts
//
// Model fallback chain with automatic retry and failover.
// Supports configurable fallback sequences per model.

export interface ModelConfig {
  id: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama';
  model: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  enabled: boolean;
}

export interface FallbackChain {
  primary: ModelConfig;
  fallbacks: ModelConfig[];
}

export interface ModelAttempt {
  model: string;
  provider: string;
  success: boolean;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface FallbackResult {
  success: boolean;
  attempts: ModelAttempt[];
  finalModel?: string;
  response?: unknown;
  error?: string;
}

export class ModelFallbackChain {
  private chains = new Map<string, FallbackChain>();
  private history: ModelAttempt[] = [];

  /**
   * Register a fallback chain for a primary model.
   */
  registerChain(primary: ModelConfig, fallbacks: ModelConfig[]): void {
    this.chains.set(primary.id, { primary, fallbacks });
  }

  /**
   * Execute a request with automatic fallback.
   */
  async execute<T>(
    primaryModelId: string,
    fn: (config: ModelConfig) => Promise<T>,
    options: { maxAttempts?: number } = {}
  ): Promise<FallbackResult> {
    const chain = this.chains.get(primaryModelId);
    if (!chain) {
      return {
        success: false,
        attempts: [],
        error: `No fallback chain registered for model: ${primaryModelId}`,
      };
    }

    const allModels = [chain.primary, ...chain.fallbacks.filter((m) => m.enabled)];
    const maxAttempts = options.maxAttempts ?? allModels.length;
    const attempts: ModelAttempt[] = [];

    for (let i = 0; i < Math.min(maxAttempts, allModels.length); i++) {
      const config = allModels[i];
      const start = Date.now();

      try {
        const response = await this.executeWithTimeout(fn, config.timeoutMs);
        const duration = Date.now() - start;

        const attempt: ModelAttempt = {
          model: config.model,
          provider: config.provider,
          success: true,
          duration,
          timestamp: Date.now(),
        };

        attempts.push(attempt);
        this.history.push(attempt);

        return {
          success: true,
          attempts,
          finalModel: config.id,
          response,
        };
      } catch (error) {
        const duration = Date.now() - start;
        const message = error instanceof Error ? error.message : 'Unknown error';

        const attempt: ModelAttempt = {
          model: config.model,
          provider: config.provider,
          success: false,
          error: message,
          duration,
          timestamp: Date.now(),
        };

        attempts.push(attempt);
        this.history.push(attempt);

        // If this was the last model, return failure
        if (i === allModels.length - 1) {
          return {
            success: false,
            attempts,
            error: `All models failed. Last error: ${message}`,
          };
        }

        // Log fallback
        console.log(`[ModelFallback] ${config.model} failed: ${message}. Trying next fallback...`);
      }
    }

    return {
      success: false,
      attempts,
      error: 'No models available',
    };
  }

  /**
   * Get attempt history.
   */
  getHistory(limit: number = 50): ModelAttempt[] {
    return this.history.slice(-limit);
  }

  /**
   * Get stats.
   */
  getStats(): {
    totalAttempts: number;
    successRate: number;
    byModel: Record<string, { attempts: number; successes: number }>;
  } {
    const byModel: Record<string, { attempts: number; successes: number }> = {};

    for (const attempt of this.history) {
      if (!byModel[attempt.model]) {
        byModel[attempt.model] = { attempts: 0, successes: 0 };
      }
      byModel[attempt.model].attempts++;
      if (attempt.success) {
        byModel[attempt.model].successes++;
      }
    }

    const totalAttempts = this.history.length;
    const totalSuccesses = this.history.filter((a) => a.success).length;

    return {
      totalAttempts,
      successRate: totalAttempts > 0 ? totalSuccesses / totalAttempts : 0,
      byModel,
    };
  }

  /**
   * Clear history.
   */
  clearHistory(): void {
    this.history = [];
  }

  private async executeWithTimeout<T>(fn: (config: ModelConfig) => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn({
        id: '',
        provider: 'openai',
        model: '',
        priority: 0,
        maxRetries: 0,
        timeoutMs: 0,
        enabled: true,
      })
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

// Singleton
let fallbackInstance: ModelFallbackChain | null = null;

export function getModelFallbackChain(): ModelFallbackChain {
  if (!fallbackInstance) {
    fallbackInstance = new ModelFallbackChain();
  }
  return fallbackInstance;
}
