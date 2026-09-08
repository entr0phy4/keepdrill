import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// COOP/COEP unlock cross-origin isolation -> high-resolution timers (D-15, D-16).
// server.headers and preview.headers are INDEPENDENT Vite options and are NOT
// inherited from one another (01-RESEARCH.md Pitfall 1) — set both.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/capture/**', 'src/persistence/**'],
        },
      },
      {
        test: {
          name: 'persistence',
          environment: 'node',
          include: ['src/persistence/**/*.test.ts'],
          setupFiles: ['./src/test/setup-fake-indexeddb.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['src/capture/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'ui',
          environment: 'happy-dom',
          include: ['src/ui/**/*.test.tsx'],
          setupFiles: ['./src/test/setup-fake-indexeddb.ts'],
        },
      },
    ],
  },
})
