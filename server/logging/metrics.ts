// server/logging/metrics.ts
//
// Simple in-memory metrics collector.

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
}

interface CounterValue {
  count: number;
  lastIncrement: number;
}

class Metrics {
  private histograms = new Map<string, MetricValue>();
  private counters = new Map<string, CounterValue>();
  private gauges = new Map<string, number>();

  // Histogram (for durations, sizes, etc.)
  recordHistogram(name: string, value: number): void {
    const existing = this.histograms.get(name);
    if (existing) {
      existing.count++;
      existing.sum += value;
      existing.min = Math.min(existing.min, value);
      existing.max = Math.max(existing.max, value);
      existing.last = value;
    } else {
      this.histograms.set(name, {
        count: 1,
        sum: value,
        min: value,
        max: value,
        last: value,
      });
    }
  }

  getHistogram(name: string): (MetricValue & { avg: number }) | undefined {
    const h = this.histograms.get(name);
    if (!h) return undefined;
    return { ...h, avg: h.sum / h.count };
  }

  // Counter (for increments)
  incrementCounter(name: string, value: number = 1): void {
    const existing = this.counters.get(name);
    if (existing) {
      existing.count += value;
      existing.lastIncrement = Date.now();
    } else {
      this.counters.set(name, {
        count: value,
        lastIncrement: Date.now(),
      });
    }
  }

  getCounter(name: string): CounterValue | undefined {
    return this.counters.get(name);
  }

  // Gauge (for current values)
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  // Get all metrics
  getAll(): {
    histograms: Record<string, MetricValue & { avg: number }>;
    counters: Record<string, CounterValue>;
    gauges: Record<string, number>;
  } {
    const histograms: Record<string, MetricValue & { avg: number }> = {};
    for (const [name, value] of this.histograms) {
      histograms[name] = { ...value, avg: value.sum / value.count };
    }

    const counters: Record<string, CounterValue> = {};
    for (const [name, value] of this.counters) {
      counters[name] = { ...value };
    }

    const gauges: Record<string, number> = {};
    for (const [name, value] of this.gauges) {
      gauges[name] = value;
    }

    return { histograms, counters, gauges };
  }

  // Reset all metrics
  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
  }
}

// Singleton
export const metrics = new Metrics();

// Middleware to track request metrics
export function metricsMiddleware(req: any, res: any, next: any): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    metrics.recordHistogram('http.request.duration', duration);
    metrics.incrementCounter(`http.requests.${req.method}`);
    metrics.incrementCounter(`http.responses.${res.statusCode}`);
    metrics.incrementCounter('http.requests.total');

    if (res.statusCode >= 500) {
      metrics.incrementCounter('http.errors.5xx');
    } else if (res.statusCode >= 400) {
      metrics.incrementCounter('http.errors.4xx');
    }
  });

  next();
}

// Predefined metric names
export const METRICS = {
  HTTP_DURATION: 'http.request.duration',
  HTTP_REQUESTS: 'http.requests.total',
  HTTP_ERRORS_4XX: 'http.errors.4xx',
  HTTP_ERRORS_5XX: 'http.errors.5xx',
  AGENT_RUNS: 'agent.runs.total',
  AGENT_RUN_DURATION: 'agent.run.duration',
  MCP_REQUESTS: 'mcp.requests.total',
  MCP_DURATION: 'mcp.request.duration',
} as const;
