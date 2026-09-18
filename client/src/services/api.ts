import axios from 'axios'
import config from '../lib/config'

export const AUTH_TOKEN_KEY = 'darukaa.access_token'

let unauthorizedHandler: (() => void) | null = null

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler
}

export const getStoredToken = () => localStorage.getItem(AUTH_TOKEN_KEY)

export const storeToken = (token: string) => localStorage.setItem(AUTH_TOKEN_KEY, token)

export const clearStoredToken = () => localStorage.removeItem(AUTH_TOKEN_KEY)

export const normalizeApiError = (error: any) => {
  if (!error.response) {
    return 'The server is currently unavailable. Please try again.'
  }

  const detail = error.response.data?.detail
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return 'Please check the highlighted fields.'
  }

  if (error.response.status >= 500) {
    return 'The server is currently unavailable. Please try again.'
  }

  return 'Something went wrong. Please try again.'
}

const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((request) => {
  const token = getStoredToken()
  if (token) {
    request.headers.Authorization = `Bearer ${token}`
  }
  return request
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredToken()
      unauthorizedHandler?.()
    }
    return Promise.reject(error)
  },
)

export default api