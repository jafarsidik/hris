/**
 * Structured-enough logging for a headless process.
 *
 * The worker has no HTTP request to attach context to, so every line carries the
 * job's correlation fields explicitly. Kept tiny rather than pulling in a logger
 * framework; the API owns rich logging, this only needs to be greppable.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(level: string = 'info'): Logger {
  const rank: Record<LogLevel, number> = { info: 1, warn: 2, error: 3 };
  const threshold = rank[(level as LogLevel) in rank ? (level as LogLevel) : 'info'];

  const write = (
    entryLevel: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void => {
    if (rank[entryLevel] < threshold) {
      return;
    }
    const line = JSON.stringify({
      level: entryLevel,
      time: new Date().toISOString(),
      scope: 'worker',
      message,
      ...context,
    });
    if (entryLevel === 'error') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  };

  return {
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
