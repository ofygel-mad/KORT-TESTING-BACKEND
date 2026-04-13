import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

function getPackageName(id: string) {
  const parts = id.split('node_modules/');
  const packagePath = parts[parts.length - 1];
  const segments = packagePath.split('/');

  if (segments[0].startsWith('@') && segments[1]) {
    return `${segments[0]}/${segments[1]}`;
  }

  return segments[0];
}

function getVendorChunkName(id: string, pkg: string) {
  if (pkg === 'react' || pkg === 'react-dom' || pkg === 'scheduler') {
    return 'vendor-react';
  }

  if (
    pkg === 'react-router'
    || pkg === 'react-router-dom'
    || pkg === '@remix-run/router'
  ) {
    return 'vendor-router';
  }

  if (pkg.startsWith('@tanstack/')) {
    return 'vendor-query';
  }

  if (
    pkg === 'recharts'
    || pkg.startsWith('d3-')
    || pkg === 'victory-vendor'
    || pkg === 'react-smooth'
    || pkg === 'recharts-scale'
    || pkg === 'decimal.js-light'
    || pkg === 'internmap'
  ) {
    return 'vendor-charts';
  }

  if (
    pkg === 'framer-motion'
    || pkg === 'gsap'
    || pkg === 'motion'
    || pkg === 'motion-dom'
    || pkg === 'motion-utils'
  ) {
    return 'vendor-motion';
  }

  if (pkg === 'three') {
    if (id.includes('/examples/jsm/postprocessing/')) {
      return 'vendor-three-postprocessing';
    }

    if (id.includes('/examples/jsm/')) {
      return 'vendor-three-examples';
    }

    return 'vendor-three-core';
  }

  if (pkg.startsWith('@react-three/')) {
    return 'vendor-three-examples';
  }

  if (pkg === 'lucide-react') {
    return 'vendor-icons';
  }

  if (pkg === 'date-fns') {
    return 'vendor-date';
  }

  if (pkg === 'react-hook-form' || pkg.startsWith('@hookform/') || pkg === 'zod') {
    return 'vendor-forms';
  }

  if (pkg.startsWith('@dnd-kit/')) {
    return 'vendor-dnd';
  }

  if (
    pkg === 'zustand'
    || pkg === 'immer'
    || pkg === 'use-sync-external-store'
  ) {
    return 'vendor-state';
  }

  if (pkg === '@sentry/react' || pkg === '@sentry/browser' || pkg.startsWith('@sentry/')) {
    return 'vendor-sentry';
  }

  if (
    pkg === 'axios'
    || pkg === 'nanoid'
    || pkg === 'sonner'
    || pkg === 'clsx'
    || pkg === 'lodash'
    || pkg === 'tiny-invariant'
    || pkg === 'eventemitter3'
    || pkg === 'fast-equals'
    || pkg === 'dom-helpers'
    || pkg === '@babel/runtime'
    || pkg === 'react-transition-group'
    || pkg === 'react-is'
    || pkg === 'prop-types'
  ) {
    return 'vendor-utils';
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'react': path.dirname(_require.resolve('react/package.json')),
      'react-dom': path.dirname(_require.resolve('react-dom/package.json')),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  build: {
    // The dashboard ships a dedicated Three.js runtime chunk, so keep the warning
    // threshold slightly above the isolated engine size without masking larger regressions.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          return getVendorChunkName(id, getPackageName(id));
        },
      },
    },
  },
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/**/*.e2e.{test,spec}.{ts,tsx}', 'tests/e2e/**', '**/node_modules/**', 'dist/**'],
    isolate: false,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
      ],
    },
  },
});
