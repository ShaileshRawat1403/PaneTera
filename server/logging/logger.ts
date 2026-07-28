// server/logging/logger.ts
//
// Structured JSON logger with levels and context.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  duration?: number;
  error?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.minLevel];
  }

  private format(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, options: Partial<LogEntry> = {}): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options,
    };

    const formatted = this.format(entry);

    switch (level) {
      case 'fatal':
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, options?: Partial<LogEntry>): void {
    this.log('debug', message, options);
  }

  info(message: string, options?: Partial<LogEntry>): void {
    this.log('info', message, options);
  }

  warn(message: string, options?: Partial<LogEntry>): void {
    this.log('warn', message, options);
  }

  error(message: string, error?: Error, options?: Partial<LogEntry>): void {
    this.log('error', message, {
      ...options,
      error: error?.message,
      stack: error?.stack,
    });
  }

  fatal(message: string, error?: Error, options?: Partial<LogEntry>): void {
    this.log('fatal', message, {
      ...options,
      error: error?.message,
      stack: error?.stack,
    });
  }

  // Create a child logger with context
  child(context: string): Logger {
    const childLogger = new Logger(this.minLevel);
    const originalLog = childLogger.log.bind(childLogger);
    childLogger.log = (level, message, options = {}) => {
      originalLog(level, message, { ...options, context });
    };
    return childLogger;
  }

  // Timer utility
  startTimer(label: string): { end: (metadata?: Record<string, unknown>) => void } {
    const start = Date.now();
    return {
      end: (metadata?: Record<string, unknown>) => {
        const duration = Date.now() - start;
        this.info(`${label} completed`, { duration, metadata });
      },
    };
  }
}

// Singleton logger
const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || 'info');

export { logger, Logger };

// Request logging middleware
export function requestLogger(req: any, res: any, next: any): void {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level: 'error' | 'warn' | 'info' = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const meta = {
      requestId,
      duration,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent'],
      },
    };

    if (level === 'error') {
      logger.error(`${req.method} ${req.originalUrl}`, undefined, meta);
    } else {
      logger[level](`${req.method} ${req.originalUrl}`, meta);
    }
  });

  next();
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
