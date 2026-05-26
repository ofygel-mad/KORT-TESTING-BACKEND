import { defineConfig } from 'vitest/config';

// Default vitest config — unit-only. *.integration.test.ts files are
// excluded here so the suite runs cleanly in CI/Railway build where no
// test Postgres is available. For the integration-only suite see
// vitest.integration.config.ts. For the full union run `test:run`.
export default defineConfig({
  test: {
    globalSetup: ['./vitest.global-setup.ts'],
    // Environment
    environment: 'node',
    globals: true,

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/tests/**',
        '**/__tests__/**',
        'coverage/**',
        'prisma/**',
        'scripts/**',
        'vitest*.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },

    // Include/exclude patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      // Integration tests need a live Postgres reachable via DATABASE_URL.
      // Run them via `npm run test:integration` (vitest.integration.config.ts).
      '**/*.integration.test.ts',
    ],

    // Timeout and concurrency
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Reporters
    reporters: ['verbose', 'html'],
    outputFile: {
      html: './coverage/index.html',
    },

    // Setup files
    setupFiles: ['./vitest.setup.ts'],

    // API
    api: process.env.VITEST_UI === 'true'
      ? {
          port: Number(process.env.VITEST_UI_PORT ?? 51204),
        }
      : undefined,
  },
});
