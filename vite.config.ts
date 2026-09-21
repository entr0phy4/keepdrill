import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const srcAlias = {
  '@': path.resolve(rootDir, './src'),
} as const

type TestProjectOptions = NonNullable<NonNullable<ViteUserConfig['test']>['projects']>[number]

function testProject(test: Extract<TestProjectOptions, { test?: object }>['test']): TestProjectOptions {
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: srcAlias },
    test,
  }
}

// COOP/COEP unlock cross-origin isolation -> high-resolution timers (D-15, D-16).
// server.headers and preview.headers are INDEPENDENT Vite options and are NOT
// inherited from one another (01-RESEARCH.md Pitfall 1) — set both.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
} as const

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: srcAlias,
  },
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  test: {
    projects: [
      testProject({
        name: 'unit',
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['src/capture/**', 'src/persistence/**'],
      }),
      testProject({
        name: 'persistence',
        environment: 'node',
        include: ['src/persistence/**/*.test.ts'],
        setupFiles: ['./src/test/setup-fake-indexeddb.ts'],
      }),
      testProject({
        name: 'dom',
        environment: 'happy-dom',
        include: ['src/capture/**/*.test.ts'],
      }),
      testProject({
        name: 'ui',
        environment: 'happy-dom',
        include: ['src/**/*.test.tsx'],
        setupFiles: ['./src/test/setup-fake-indexeddb.ts'],
      }),
    ],
  },
})
