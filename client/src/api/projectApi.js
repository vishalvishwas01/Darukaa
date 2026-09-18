import api from '../services/api'

const encodeId = (value) => encodeURIComponent(value)

export const listProjects = () => api.get('/projects')
export const getProject = (projectId) => api.get(`/projects/${encodeId(projectId)}`)
export const createProject = (payload) => api.post('/projects', payload)
export const updateProject = (projectId, payload) => api.patch(`/projects/${encodeId(projectId)}`, payload)
export const deleteProject = (projectId) => api.delete(`/projects/${encodeId(projectId)}`)
