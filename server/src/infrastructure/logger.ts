/**
 * Minimal structured logger. Callers must only pass IDs and technical data —
 * never emails, names, addresses, tokens or message bodies.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';
type Meta = Record<string, string | number | boolean | null | undefined>;

const silent = process.env.NODE_ENV === 'test';

function write(level: Level, message: string, meta?: Meta) {
  if (silent && level !== 'error') return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...meta });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Meta) => write('debug', message, meta),
  info: (message: string, meta?: Meta) => write('info', message, meta),
  warn: (message: string, meta?: Meta) => write('warn', message, meta),
  error: (message: string, meta?: Meta) => write('error', message, meta),
};

/** Reduces an unknown error to name + message (no stack with data in production logs). */
export function describeError(error: unknown): Meta {
  if (error instanceof Error) return { errorName: error.name, errorMessage: error.message };
  return { errorName: 'Unknown' };
}
