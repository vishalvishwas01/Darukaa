import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

// Vitest reuses the production Vite config (React JSX transform, ESM) and only adds test settings,
// so production build behavior stays untouched. Tests never touch the network, a real backend,
// Mapbox or a real browser.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules/**', 'dist/**'],
    clearMocks: true,
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
    },
  },
}))
