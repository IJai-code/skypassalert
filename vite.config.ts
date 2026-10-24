/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Custom domain at the root, so assets resolve from "/".
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        // Keep satellite.js's optional WebAssembly runtime (and its pthreads worker) out of the bundle.
        find: /^#wasm-(single|multi)-thread$/,
        replacement: fileURLToPath(new URL('./src/engine/propagate/no-wasm.ts', import.meta.url)),
      },
    ],
  },
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.test.ts', 'src/engine/__fixtures__/**'],
      // The engine is the part that must be right; CI fails below these.
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 80 },
    },
  },
})
