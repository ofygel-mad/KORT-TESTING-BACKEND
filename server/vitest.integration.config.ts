import { defineConfig } from 'vitest/config';

// Integration vitest config — runs ONLY *.integration.test.ts files.
// Requires a live Postgres reachable via DATABASE_URL (.env.test). Use
// for local pre-push checks and as a CI step where a test DB is available.
// Mirrors the heavy-test options from vitest.config.ts (timeouts,
// globalSetup, setup) so behaviour stays identical.
export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-setup.ts'],
    environment: 'node',
    globals: true,

    include: ['src/**/*.integration.test.ts'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],

    // Integration tests touch the DB; give them headroom.
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    isolate: true,
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    reporters: ['verbose'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
