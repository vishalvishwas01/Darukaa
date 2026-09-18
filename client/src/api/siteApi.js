import api from '../services/api'

const encodeId = (value) => encodeURIComponent(value)
const sitePath = (projectId, siteId = '') => `/projects/${encodeId(projectId)}/sites${siteId ? `/${encodeId(siteId)}` : ''}`

export const listSites = (projectId) => api.get(sitePath(projectId))
export const getSite = (projectId, siteId) => api.get(sitePath(projectId, siteId))
export const createSite = (projectId, payload) => api.post(sitePath(projectId), payload)
export const updateSite = (projectId, siteId, payload) => api.patch(sitePath(projectId, siteId), payload)
export const deleteSite = (projectId, siteId) => api.delete(sitePath(projectId, siteId))
