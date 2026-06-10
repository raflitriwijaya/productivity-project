import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register, prefix: 'productivity_' });

export const httpRequestDuration = new client.Histogram({
  name: 'productivity_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'productivity_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const poolSize = new client.Gauge({
  name: 'productivity_pg_pool_connections',
  help: 'Number of PostgreSQL pool connections',
  labelNames: ['state'],
  registers: [register],
});

export { register };
