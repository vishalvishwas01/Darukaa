/**
 * Shared formatting, parsing and validation helpers for site metric records.
 *
 * Backend contract (server/app/schemas/metrics.py + server/app/models/site_metric.py):
 * - POST/PATCH body: { metric_name, metric_value, unit, recorded_at } (extra fields are forbidden)
 * - metric_name: trimmed, 1..100 characters
 * - unit: trimmed, 1..50 characters
 * - metric_value: finite decimal, stored as NUMERIC(15, 4)
 * - recorded_at: timezone-aware datetime -> serialized as an ISO-8601 instant with a UTC offset
 *
 * Timezone assumption (documented): the `datetime-local` input has no offset, so its value is
 * read as the viewer's local wall-clock time and converted to a UTC instant before the request.
 * The same viewer timezone is used when rendering timestamps, so the selected wall-clock time is
 * preserved on screen. The backend stores a timezone-aware column and never re-interprets the value.
 */

export const METRIC_NAME_MAX_LENGTH = 100
export const UNIT_MAX_LENGTH = 50

// PostgreSQL NUMERIC(15, 4): at most 11 integer digits and 4 decimal places.
export const METRIC_VALUE_LIMIT = 99999999999.9999

// Display timestamps with up to 4 decimals so NUMERIC(15, 4) precision is preserved.
export const METRIC_VALUE_PRECISION = 4

// Accepts plain decimals and scientific notation, rejects hex/exponent-less oddities.
const NUMERIC_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

const pad = (value) => String(value).padStart(2, '0')

export const formatMetricTimestamp = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const formatMetricValue = (value, maximumFractionDigits = METRIC_VALUE_PRECISION) => {
  if (value === null || value === undefined || value === '') return 'Unavailable'
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Unavailable'
  return new Intl.NumberFormat('en', { maximumFractionDigits }).format(number)
}

/** Converts a `datetime-local` wall-clock value into the UTC ISO instant the API expects. */
export const toRecordedAtIso = (localValue) => {
  const trimmed = typeof localValue === 'string' ? localValue.trim() : ''
  if (!trimmed) return ''
  const date = new Date(trimmed)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

/** Inverse of {@link toRecordedAtIso}: prefill a `datetime-local` input from an API timestamp. */
export const toDateTimeLocalValue = (isoValue) => {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export const toMetricFormValues = (metric) => ({
  metric_name: metric?.metric_name || '',
  metric_value: metric?.metric_value === null || metric?.metric_value === undefined ? '' : String(metric.metric_value),
  unit: metric?.unit || '',
  recorded_at: toDateTimeLocalValue(metric?.recorded_at),
})

export const emptyMetricFormValues = { metric_name: '', metric_value: '', unit: '', recorded_at: '' }

/** Field-level validation mirroring the backend schema. Returns {} when the form is valid. */
export const validateMetricForm = (values = {}) => {
  const errors = {}

  const metricName = typeof values.metric_name === 'string' ? values.metric_name.trim() : ''
  if (!metricName) errors.metric_name = 'Metric name is required.'
  else if (metricName.length > METRIC_NAME_MAX_LENGTH) errors.metric_name = `Metric name must be ${METRIC_NAME_MAX_LENGTH} characters or fewer.`

  const rawValue = values.metric_value === null || values.metric_value === undefined ? '' : String(values.metric_value).trim()
  if (!rawValue) {
    errors.metric_value = 'Metric value is required.'
  } else {
    const numericValue = Number(rawValue)
    if (Number.isNaN(numericValue)) errors.metric_value = 'Enter a valid number.'
    else if (!Number.isFinite(numericValue)) errors.metric_value = 'Metric value must be a finite number, not Infinity or NaN.'
    else if (!NUMERIC_PATTERN.test(rawValue)) errors.metric_value = 'Enter a valid decimal number.'
    else if (Math.abs(numericValue) > METRIC_VALUE_LIMIT) errors.metric_value = `Metric value must be between -${METRIC_VALUE_LIMIT} and ${METRIC_VALUE_LIMIT}.`
  }

  const unit = typeof values.unit === 'string' ? values.unit.trim() : ''
  if (!unit) errors.unit = 'Unit is required.'
  else if (unit.length > UNIT_MAX_LENGTH) errors.unit = `Unit must be ${UNIT_MAX_LENGTH} characters or fewer.`

  if (!values.recorded_at) errors.recorded_at = 'Recorded timestamp is required.'
  else if (!toRecordedAtIso(values.recorded_at)) errors.recorded_at = 'Enter a valid recorded date and time.'

  return errors
}

/**
 * Builds the exact create/update body. Ownership and server-generated fields
 * (id, site_id, created_at) are never sent.
 */
export const toMetricPayload = (values = {}) => ({
  metric_name: String(values.metric_name ?? '').trim(),
  metric_value: Number(String(values.metric_value ?? '').trim()),
  unit: String(values.unit ?? '').trim(),
  recorded_at: toRecordedAtIso(values.recorded_at),
})

/** Maps a 422 validation response into field-level errors when the backend sends loc/msg pairs. */
export const toFieldErrors = (requestError) => {
  const detail = requestError?.response?.data?.detail
  if (!Array.isArray(detail)) return {}
  const fieldErrors = {}
  detail.forEach((entry) => {
    const field = Array.isArray(entry?.loc) ? entry.loc[entry.loc.length - 1] : null
    if (field && typeof entry?.msg === 'string' && !fieldErrors[field]) {
      fieldErrors[field] = entry.msg.replace(/^Value error,\s*/, '')
    }
  })
  return fieldErrors
}

/** Sorts metric records newest first using the same tie-breaker as the backend list endpoint. */
export const sortMetricsNewestFirst = (records = []) => [...records].sort((left, right) => {
  const leftTime = new Date(left?.recorded_at).getTime()
  const rightTime = new Date(right?.recorded_at).getTime()
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return 0
  if (rightTime !== leftTime) return rightTime - leftTime
  return String(right?.id || '').localeCompare(String(left?.id || ''))
})