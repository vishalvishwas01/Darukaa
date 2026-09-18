/**
 * Synthetic fixtures shared by frontend tests. These mirror the real API response shapes
 * (metric_value arrives as a decimal string, timestamps as UTC ISO instants) but contain no real
 * database records. They live under src/test and are never imported by production code.
 */
export const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
export const SITE_ID = '22222222-2222-4222-8222-222222222222'

export const metricRecord = (overrides = {}) => ({
  id: '33333333-3333-4333-8333-333333333333',
  site_id: SITE_ID,
  metric_name: 'carbon_stock',
  metric_value: '128.4500',
  unit: 'tonnes',
  recorded_at: '2026-03-04T05:06:00Z',
  created_at: '2026-03-04T05:07:00Z',
  ...overrides,
})

export const metricPage = (items, overrides = {}) => ({
  items,
  total: items.length,
  limit: 200,
  offset: 0,
  ...overrides,
})

export const siteSummary = (overrides = {}) => ({
  site_id: SITE_ID,
  total_metric_records: 3,
  available_metric_names: ['carbon_stock', 'soil_ph'],
  earliest_recorded_at: '2026-01-01T00:00:00Z',
  latest_recorded_at: '2026-03-04T05:06:00Z',
  metrics: [
    {
      metric_name: 'carbon_stock',
      unit: 'tonnes',
      record_count: 2,
      minimum_value: '10.0000',
      maximum_value: '128.4500',
      average_value: '69.2250',
      latest_value: '128.4500',
      latest_recorded_at: '2026-03-04T05:06:00Z',
    },
    {
      metric_name: 'soil_ph',
      unit: 'pH',
      record_count: 1,
      minimum_value: '6.4000',
      maximum_value: '6.4000',
      average_value: '6.4000',
      latest_value: '6.4000',
      latest_recorded_at: '2026-02-01T00:00:00Z',
    },
  ],
  ...overrides,
})

export const emptySiteSummary = () => ({
  site_id: SITE_ID,
  total_metric_records: 0,
  available_metric_names: [],
  earliest_recorded_at: null,
  latest_recorded_at: null,
  metrics: [],
})

export const timeSeries = (overrides = {}) => ({
  site_id: SITE_ID,
  metric_name: 'carbon_stock',
  unit: 'tonnes',
  points: [
    { recorded_at: '2026-01-01T00:00:00Z', value: '10.0000' },
    { recorded_at: '2026-03-04T05:06:00Z', value: '128.4500' },
  ],
  ...overrides,
})

export const projectSummary = (overrides = {}) => ({
  project_id: PROJECT_ID,
  total_sites: 2,
  total_metric_records: 3,
  available_metric_names: ['carbon_stock', 'soil_ph'],
  metrics: [
    {
      metric_name: 'carbon_stock',
      unit: 'tonnes',
      record_count: 2,
      minimum_value: '10.0000',
      maximum_value: '128.4500',
      average_value: '69.2250',
      latest_value: '128.4500',
      latest_recorded_at: '2026-03-04T05:06:00Z',
    },
    {
      metric_name: 'soil_ph',
      unit: 'pH',
      record_count: 1,
      minimum_value: '6.4000',
      maximum_value: '6.4000',
      average_value: '6.4000',
      latest_value: '6.4000',
      latest_recorded_at: '2026-02-01T00:00:00Z',
    },
  ],
  site_record_counts: [
    { site_id: SITE_ID, record_count: 2 },
    { site_id: '44444444-4444-4444-8444-444444444444', record_count: 1 },
  ],
  ...overrides,
})

export const emptyProjectSummary = () => ({
  project_id: PROJECT_ID,
  total_sites: 1,
  total_metric_records: 0,
  available_metric_names: [],
  metrics: [],
  site_record_counts: [],
})

/** Manually resolvable promise, used to assert in-flight (loading/disabled) behaviour. */
export const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

/** Axios-style rejection for a status code with a FastAPI `detail` body. */
export const apiError = (status, detail) => Object.assign(new Error(`Request failed with status code ${status}`), {
  response: { status, data: detail === undefined ? {} : { detail } },
})
