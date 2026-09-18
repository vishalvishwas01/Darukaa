import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { createMetric, updateMetric } from '../../../api/metricApi'
import { normalizeApiError } from '../../../services/api'
import {
  emptyMetricFormValues,
  METRIC_NAME_MAX_LENGTH,
  toFieldErrors,
  toMetricFormValues,
  toMetricPayload,
  UNIT_MAX_LENGTH,
  validateMetricForm,
} from '../utils/metricFormat'

const FIELD_IDS = {
  metric_name: 'metric-name',
  metric_value: 'metric-value',
  unit: 'metric-unit',
  recorded_at: 'metric-recorded-at',
}

const FIELD_LABELS = {
  metric_name: 'Metric name',
  metric_value: 'Metric value',
  unit: 'Unit',
  recorded_at: 'Recorded timestamp',
}

function FieldError({ id, message }) {
  if (!message) return null
  return <p className="field-error" id={id} role="alert">{message}</p>
}

export default function MetricForm({ projectId, siteId, metric, onSuccess, onCancel }) {
  const isEditing = Boolean(metric?.id)
  const [values, setValues] = useState(() => (isEditing ? toMetricFormValues(metric) : { ...emptyMetricFormValues }))
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const describedBy = (field) => (fieldErrors[field] ? `${FIELD_IDS[field]}-error` : undefined)

  const updateField = (event) => {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setFieldErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    const validationErrors = validateMetricForm(values)
    setFieldErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      setError('Please correct the highlighted fields.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const payload = toMetricPayload(values)
      const response = isEditing
        ? await updateMetric(projectId, siteId, metric.id, payload)
        : await createMetric(projectId, siteId, payload)
      onSuccess(response.data)
    } catch (requestError) {
      const apiFieldErrors = toFieldErrors(requestError)
      setFieldErrors(apiFieldErrors)
      setError(Object.keys(apiFieldErrors).length > 0 ? 'Please correct the highlighted fields.' : normalizeApiError(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <form className="resource-form" onSubmit={submit} noValidate>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <div className="development-note"><strong>Recorded values only</strong><span>Nothing is pre-filled, so every saved value comes from your own field measurement.</span></div>

    <label className="field-label" htmlFor={FIELD_IDS.metric_name}>{FIELD_LABELS.metric_name} <span className="field-hint">Required</span></label>
    <input
      id={FIELD_IDS.metric_name}
      className="text-input"
      name="metric_name"
      type="text"
      value={values.metric_name}
      onChange={updateField}
      maxLength={METRIC_NAME_MAX_LENGTH}
      placeholder="e.g. carbon_stock"
      autoComplete="off"
      required
      aria-invalid={fieldErrors.metric_name ? 'true' : 'false'}
      aria-describedby={describedBy('metric_name')}
    />
    <FieldError id={`${FIELD_IDS.metric_name}-error`} message={fieldErrors.metric_name} />

    <label className="field-label" htmlFor={FIELD_IDS.metric_value}>{FIELD_LABELS.metric_value} <span className="field-hint">Required</span></label>
    <input
      id={FIELD_IDS.metric_value}
      className="text-input"
      name="metric_value"
      type="number"
      step="any"
      inputMode="decimal"
      value={values.metric_value}
      onChange={updateField}
      placeholder="e.g. 128.45"
      autoComplete="off"
      required
      aria-invalid={fieldErrors.metric_value ? 'true' : 'false'}
      aria-describedby={describedBy('metric_value')}
    />
    <FieldError id={`${FIELD_IDS.metric_value}-error`} message={fieldErrors.metric_value} />

    <label className="field-label" htmlFor={FIELD_IDS.unit}>{FIELD_LABELS.unit} <span className="field-hint">Required</span></label>
    <input
      id={FIELD_IDS.unit}
      className="text-input"
      name="unit"
      type="text"
      value={values.unit}
      onChange={updateField}
      maxLength={UNIT_MAX_LENGTH}
      placeholder="e.g. tonnes"
      autoComplete="off"
      required
      aria-invalid={fieldErrors.unit ? 'true' : 'false'}
      aria-describedby={describedBy('unit')}
    />
    <FieldError id={`${FIELD_IDS.unit}-error`} message={fieldErrors.unit} />

    <label className="field-label" htmlFor={FIELD_IDS.recorded_at}>{FIELD_LABELS.recorded_at} <span className="field-hint">Your local time</span></label>
    <input
      id={FIELD_IDS.recorded_at}
      className="text-input"
      name="recorded_at"
      type="datetime-local"
      value={values.recorded_at}
      onChange={updateField}
      required
      aria-invalid={fieldErrors.recorded_at ? 'true' : 'false'}
      aria-describedby={describedBy('recorded_at')}
    />
    <FieldError id={`${FIELD_IDS.recorded_at}-error`} message={fieldErrors.recorded_at} />
    <p className="field-note">Saved as an exact instant using your device timezone, then shown back in the same timezone.</p>

    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
      <button className="primary-button" type="submit" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="spin" size={17} />}
        {isSubmitting ? 'Saving...' : isEditing ? 'Save metric record' : 'Add metric record'}
      </button>
    </div>
  </form>
}
