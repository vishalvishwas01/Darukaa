import api from '../services/api'

const encodeId = (value) => encodeURIComponent(value)

export const getSiteAnalyticsSummary = (projectId, siteId) => api.get(`/projects/${encodeId(projectId)}/sites/${encodeId(siteId)}/analytics/summary`)

export const getSiteTimeSeries = (projectId, siteId, params = {}) => api.get(`/projects/${encodeId(projectId)}/sites/${encodeId(siteId)}/analytics/timeseries`, { params })

export const getProjectAnalyticsSummary = (projectId) => api.get(`/projects/${encodeId(projectId)}/analytics/summary`)
