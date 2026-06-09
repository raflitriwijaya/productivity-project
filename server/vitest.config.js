// Phase 4: vitest configuration for server integration tests
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Run test files sequentially — avoids pool/session state conflicts across files
    singleFork: true,
    timeout: 30_000,
  },
});
