import api from '../../../services/api'

export const registerUser = (payload) => api.post('/auth/register', payload)

export const loginUser = (payload) => api.post('/auth/login', payload)

export const fetchCurrentUser = () => api.get('/auth/me')
