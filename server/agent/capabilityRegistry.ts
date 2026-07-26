// server/agent/capabilityRegistry.ts
//
// Centralized capability registry with metadata, health, and versioning.
// Provides a single source of truth for all available agent capabilities.

import { EventEmitter } from 'events';

export interface CapabilityMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'core' | 'browser' | 'mcp' | 'custom';
  source: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck: number;
  healthCheckInterval: number;
  tags: string[];
  config?: Record<string, unknown>;
}

export interface HealthCheckResult {
  healthy: boolean;
  message?: string;
  latency?: number;
}

export type HealthChecker = (capability: CapabilityMetadata) => Promise<HealthCheckResult>;

export class CapabilityRegistry extends EventEmitter {
  private capabilities = new Map<string, CapabilityMetadata>();
  private healthCheckers = new Map<string, HealthChecker>();
  private healthTimers = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Register a capability.
   */
  register(
    metadata: Omit<CapabilityMetadata, 'health' | 'lastHealthCheck'>,
    healthCheck?: HealthChecker
  ): void {
    const cap: CapabilityMetadata = {
      ...metadata,
      health: 'healthy',
      lastHealthCheck: Date.now(),
    };

    this.capabilities.set(cap.id, cap);

    if (healthCheck) {
      this.healthCheckers.set(cap.id, healthCheck);
      this.startHealthCheck(cap);
    }

    this.emit('registered', cap);
  }

  /**
   * Unregister a capability.
   */
  unregister(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;

    this.stopHealthCheck(id);
    this.capabilities.delete(id);
    this.healthCheckers.delete(id);

    this.emit('unregistered', cap);
    return true;
  }

  /**
   * Get a capability by ID.
   */
  get(id: string): CapabilityMetadata | undefined {
    return this.capabilities.get(id);
  }

  /**
   * Get all capabilities with optional filters.
   */
  getAll(filters?: { category?: string; health?: string; tag?: string }): CapabilityMetadata[] {
    let caps = Array.from(this.capabilities.values());

    if (filters?.category) {
      caps = caps.filter((c) => c.category === filters.category);
    }
    if (filters?.health) {
      caps = caps.filter((c) => c.health === filters.health);
    }
    if (filters?.tag) {
      caps = caps.filter((c) => c.tags.includes(filters.tag!));
    }

    return caps;
  }

  /**
   * Get capabilities as agent-compatible format.
   */
  getAsCapabilities(): Array<{ id: string; name: string; description: string; inputSchema?: unknown }> {
    return this.getAll({ health: 'healthy' }).map((cap) => ({
      id: cap.id,
      name: cap.name,
      description: cap.description,
    }));
  }

  /**
   * Run health check for a capability.
   */
  async checkHealth(id: string): Promise<HealthCheckResult> {
    const cap = this.capabilities.get(id);
    if (!cap) {
      return { healthy: false, message: 'Capability not found' };
    }

    const checker = this.healthCheckers.get(id);
    if (!checker) {
      return { healthy: true, message: 'No health checker configured' };
    }

    const start = Date.now();
    try {
      const result = await checker(cap);
      const latency = Date.now() - start;

      cap.health = result.healthy ? 'healthy' : 'unhealthy';
      cap.lastHealthCheck = Date.now();

      this.emit('health-changed', { id, health: cap.health, latency, message: result.message });

      return { ...result, latency };
    } catch (error) {
      cap.health = 'unhealthy';
      cap.lastHealthCheck = Date.now();

      const message = error instanceof Error ? error.message : 'Health check failed';
      this.emit('health-changed', { id, health: 'unhealthy', message });

      return { healthy: false, message };
    }
  }

  /**
   * Run health checks for all capabilities.
   */
  async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    const checks = Array.from(this.capabilities.keys()).map(async (id) => {
      const result = await this.checkHealth(id);
      results.set(id, result);
    });

    await Promise.allSettled(checks);
    return results;
  }

  /**
   * Update capability config.
   */
  updateConfig(id: string, config: Record<string, unknown>): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;

    cap.config = { ...cap.config, ...config };
    this.emit('config-updated', { id, config: cap.config });
    return true;
  }

  /**
   * Get registry stats.
   */
  getStats(): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    byCategory: Record<string, number>;
  } {
    const caps = Array.from(this.capabilities.values());
    const byCategory: Record<string, number> = {};

    for (const cap of caps) {
      byCategory[cap.category] = (byCategory[cap.category] || 0) + 1;
    }

    return {
      total: caps.length,
      healthy: caps.filter((c) => c.health === 'healthy').length,
      degraded: caps.filter((c) => c.health === 'degraded').length,
      unhealthy: caps.filter((c) => c.health === 'unhealthy').length,
      byCategory,
    };
  }

  private startHealthCheck(cap: CapabilityMetadata): void {
    if (cap.healthCheckInterval <= 0) return;

    const timer = setInterval(async () => {
      await this.checkHealth(cap.id);
    }, cap.healthCheckInterval);

    this.healthTimers.set(cap.id, timer);
  }

  private stopHealthCheck(id: string): void {
    const timer = this.healthTimers.get(id);
    if (timer) {
      clearInterval(timer);
      this.healthTimers.delete(id);
    }
  }
}

// Singleton
let registryInstance: CapabilityRegistry | null = null;

export function getCapabilityRegistry(): CapabilityRegistry {
  if (!registryInstance) {
    registryInstance = new CapabilityRegistry();
  }
  return registryInstance;
}
