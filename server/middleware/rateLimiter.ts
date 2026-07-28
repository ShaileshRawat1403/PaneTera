// server/middleware/rateLimiter.ts
//
// Token bucket rate limiter middleware for Express.
// Supports per-IP and per-route limits.

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export function rateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, TokenBucket>();
  const { windowMs, maxRequests, message } = config;
  const keyGenerator = config.keyGenerator || ((req: Request) => req.ip || 'unknown');

  // Cleanup old buckets periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > windowMs * 2) {
        buckets.delete(key);
      }
    }
  }, windowMs);

  // Prevent cleanup from keeping process alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxRequests, lastRefill: now };
      buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillCount = Math.floor(elapsed / windowMs) * maxRequests;
    if (refillCount > 0) {
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refillCount);
      bucket.lastRefill = now;
    }

    if (bucket.tokens <= 0) {
      res.status(429).json({
        error: 'Too many requests',
        message: message || `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        retryAfter: Math.ceil((bucket.lastRefill + windowMs - now) / 1000),
      });
      return;
    }

    bucket.tokens--;
    next();
  };
}

// Preset rate limiters
export const apiLimiter = rateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'Too many API requests',
});

export const agentRunLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many agent run requests',
});

export const strictLimiter = rateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Rate limit exceeded for this endpoint',
});
