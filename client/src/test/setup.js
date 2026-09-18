/**
 * Vitest global setup.
 *
 * - Adds the jest-dom matchers to Vitest's expect.
 * - Unmounts rendered trees between tests (we do not enable Vitest globals, so React Testing
 *   Library cannot register its own automatic cleanup).
 * - Provides the browser APIs jsdom does not implement that our component tree can touch.
 *   These stubs only exist inside the test environment and never run in production.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

// Chart.js is mocked at the module boundary in chart-rendering tests, so the canvas context is only
// needed to keep jsdom quiet if a canvas is ever mounted.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null)
