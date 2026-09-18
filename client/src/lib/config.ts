const env = (import.meta as ImportMeta & {
  env: {
    VITE_API_BASE_URL?: string
    VITE_MAPBOX_ACCESS_TOKEN?: string
  }
}).env

const config = {
  apiBaseUrl: env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',

  mapboxToken: env.VITE_MAPBOX_ACCESS_TOKEN || '',
}

export default config