type LogLevel = 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info: (message: string, meta?: LogMeta): void => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(formatMessage('info', message, meta));
    }
  },

  warn: (message: string, meta?: LogMeta): void => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error: (message: string, error?: unknown, meta?: LogMeta): void => {
    if (process.env.NODE_ENV !== 'test') {
      const errorMeta = error instanceof Error ? { error: error.message, stack: error.stack } : { error };
      console.error(formatMessage('error', message, { ...errorMeta, ...meta }));
    }
  },
};
