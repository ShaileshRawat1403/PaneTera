// server/middleware/cache.ts
//
// Response caching middleware with TTL and invalidation.

import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: string;
  expires: number;
  etag: string;
}

interface CacheConfig {
  ttlMs: number;
  maxEntries: number;
  keyGenerator?: (req: Request) => string;
}

export function responseCache(config: CacheConfig) {
  const cache = new Map<string, CacheEntry>();
  const { ttlMs, maxEntries } = config;
  const keyGenerator = config.keyGenerator || ((req: Request) => `${req.method}:${req.originalUrl}`);

  // Cleanup expired entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (now > entry.expires) {
        cache.delete(key);
      }
    }
  }, ttlMs / 2);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = keyGenerator(req);
    const entry = cache.get(key);

    if (entry && Date.now() < entry.expires) {
      // Check ETag
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch === entry.etag) {
        res.status(304).end();
        return;
      }

      res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`);
      res.setHeader('ETag', entry.etag);
      res.setHeader('X-Cache', 'HIT');
      contentTypeJson(res).send(entry.data);
      return;
    }

    // Intercept response to cache it
    const originalSend = res.send.bind(res);
    res.send = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300 && body) {
        const data = typeof body === 'string' ? body : JSON.stringify(body);
        const etag = `"${hashString(data)}"`;

        // Evict oldest if at capacity
        if (cache.size >= maxEntries) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }

        cache.set(key, {
          data,
          expires: Date.now() + ttlMs,
          etag,
        });

        res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttlMs / 1000)}`);
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
      }

      return originalSend(body);
    };

    next();
  };
}

function contentTypeJson(res: Response): Response {
  res.setHeader('Content-Type', 'application/json');
  return res;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// Preset caches
export const manifestCache = responseCache({
  ttlMs: 30 * 1000, // 30 seconds
  maxEntries: 10,
});

export const historyCache = responseCache({
  ttlMs: 10 * 1000, // 10 seconds
  maxEntries: 50,
});

export const capabilitiesCache = responseCache({
  ttlMs: 60 * 1000, // 1 minute
  maxEntries: 20,
});
