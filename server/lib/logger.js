// Phase 3: shared pino logger — single instance used by index.js and error handler
import pino from 'pino';

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const logger = pino({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.cookie', 'req.headers.authorization'],
  ...(NODE_ENV !== 'production' && { transport: { target: 'pino-pretty' } }),
});
