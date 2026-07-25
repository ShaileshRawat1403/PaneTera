const SENSITIVE_KEY = /(?:authorization|cookie|credential|password|passwd|secret|token|api[_-]?key)/i;

export interface InspectionLimits {
  maxDepth: number;
  maxNodes: number;
  maxStringLength: number;
}

const DEFAULT_LIMITS: InspectionLimits = { maxDepth: 8, maxNodes: 500, maxStringLength: 20_000 };

/**
 * Convert untrusted structured output into bounded, inert JSON data.
 * It never interprets HTML, follows prototypes, invokes accessors, or exposes
 * common credential fields. The returned value is safe to render as text.
 */
export function inspectStructuredResult(value: unknown, limits: InspectionLimits = DEFAULT_LIMITS): unknown {
  let nodes = 0;
  const seen = new WeakSet<object>();

  const visit = (input: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > limits.maxNodes) return '[truncated: node limit]';
    if (depth > limits.maxDepth) return '[truncated: depth limit]';
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (typeof input === 'string') {
      return input.length > limits.maxStringLength
        ? `${input.slice(0, limits.maxStringLength)}… [truncated]`
        : input;
    }
    if (typeof input === 'bigint') return input.toString();
    if (typeof input !== 'object') return `[${typeof input}]`;
    if (seen.has(input)) return '[circular]';
    seen.add(input);

    if (Array.isArray(input)) return input.map((item) => visit(item, depth + 1));

    const output: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(input as object)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
      if (SENSITIVE_KEY.test(key)) {
        output[key] = '[redacted]';
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor)) {
        output[key] = '[accessor omitted]';
        continue;
      }
      output[key] = visit(descriptor.value, depth + 1);
    }
    return output;
  };

  return visit(value, 0);
}

export type RigErrorKind = 'authorization' | 'not-found' | 'server-error' | 'timeout' | 'validation';

export interface TypedRigError {
  kind: RigErrorKind;
  message: string;
  code?: string;
  details?: unknown;
}

export function normalizeRigError(raw: unknown): TypedRigError {
  if (!raw) {
    return { kind: 'server-error', message: 'An unknown error occurred.' };
  }
  if (typeof raw === 'string') {
    return { kind: 'server-error', message: raw };
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (obj.error && typeof obj.error === 'object') {
      const err = obj.error as Record<string, unknown>;
      const kind = (typeof err.kind === 'string' ? err.kind : 'server-error') as RigErrorKind;
      const message = typeof err.message === 'string' ? err.message : String(raw);
      return { kind, message, code: err.code as string | undefined, details: err.details };
    }
    if (typeof obj.error === 'string') {
      return { kind: 'server-error', message: obj.error };
    }
    if (typeof obj.message === 'string') {
      const kind = (typeof obj.kind === 'string' ? obj.kind : 'server-error') as RigErrorKind;
      return { kind, message: obj.message, code: obj.code as string | undefined, details: obj.details };
    }
  }
  return { kind: 'server-error', message: String(raw) };
}
