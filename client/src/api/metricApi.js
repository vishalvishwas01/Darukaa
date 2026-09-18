import api from '../services/api'

const encodeId = (value) => encodeURIComponent(value)
const metricPath = (projectId, siteId, metricId = '') => `/projects/${encodeId(projectId)}/sites/${encodeId(siteId)}/metrics${metricId ? `/${encodeId(metricId)}` : ''}`

export const listMetrics = (projectId, siteId, params = {}) => api.get(metricPath(projectId, siteId), { params })
export const createMetric = (projectId, siteId, payload) => api.post(metricPath(projectId, siteId), payload)
export const updateMetric = (projectId, siteId, metricId, payload) => api.patch(metricPath(projectId, siteId, metricId), payload)
export const deleteMetric = (projectId, siteId, metricId) => api.delete(metricPath(projectId, siteId, metricId))
