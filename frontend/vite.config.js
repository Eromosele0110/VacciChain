import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // The manifest feeds scripts/bundle-report.mjs.
  build: { manifest: true },

  server: {
    port: 3000,
    proxy: {
      '/v1': 'http://backend:4000',
    },
  },

  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      include: ['src/**/*.{js,jsx}'],
      thresholds: {
        lines: 70,
      },
    },
  },
})