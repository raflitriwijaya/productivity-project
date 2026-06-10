import { poolSize } from './metrics.js';
import { pool } from './db.js';

const POLL_INTERVAL_MS = 15_000;

let interval;

export function startPoolMetrics() {
  if (interval) return;

  interval = setInterval(() => {
    try {
      poolSize.set({ state: 'total' }, pool.totalCount);
      poolSize.set({ state: 'idle' }, pool.idleCount);
      poolSize.set({ state: 'waiting' }, pool.waitingCount);
    } catch {
      // Pool not yet initialized — ignore
    }
  }, POLL_INTERVAL_MS);

  interval.unref();
}

export function stopPoolMetrics() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
