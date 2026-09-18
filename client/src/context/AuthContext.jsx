import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearStoredToken,
  getStoredToken,
  normalizeApiError,
  setUnauthorizedHandler,
  storeToken,
} from '../services/api'
import { fetchCurrentUser, loginUser, registerUser } from '../features/auth/services/authApi'
import AuthContext from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => getStoredToken())
  const [isLoading, setIsLoading] = useState(true)

  const clearAuth = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
  }, [])

  const refreshCurrentUser = useCallback(async () => {
    try {
      const response = await fetchCurrentUser()
      setUser(response.data)
      return response.data
    } catch (error) {
      clearAuth()
      throw error
    }
  }, [clearAuth])

  const login = useCallback(async (credentials) => {
    const response = await loginUser(credentials)
    const nextToken = response.data.access_token
    storeToken(nextToken)
    setToken(nextToken)
    await refreshCurrentUser()
  }, [refreshCurrentUser])

  const register = useCallback(async (payload) => {
    const response = await registerUser(payload)
    return response.data
  }, [])

  const logout = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearAuth()
      if (!['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login')
      }
    })

    const restore = async () => {
      if (getStoredToken()) {
        try {
          await refreshCurrentUser()
        } catch {
          // Invalid tokens are cleared by refreshCurrentUser.
        }
      }
      setIsLoading(false)
    }

    restore()
    return () => setUnauthorizedHandler(null)
  }, [clearAuth, refreshCurrentUser])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      logout,
      refreshCurrentUser,
      getErrorMessage: normalizeApiError,
    }),
    [isLoading, login, logout, refreshCurrentUser, register, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
