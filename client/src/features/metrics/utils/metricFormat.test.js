import { describe, expect, it } from 'vitest'
import {
  emptyMetricFormValues,
  formatMetricTimestamp,
  formatMetricValue,
  METRIC_VALUE_LIMIT,
  sortMetricsNewestFirst,
  toDateTimeLocalValue,
  toFieldErrors,
  toMetricFormValues,
  toMetricPayload,
  toRecordedAtIso,
  UNIT_MAX_LENGTH,
  validateMetricForm,
} from './metricFormat'

const validForm = {
  metric_name: 'carbon_stock',
  metric_value: '128.45',
  unit: 'tonnes',
  recorded_at: '2026-03-04T05:06',
}

describe('metric form validation', () => {
  it('requires every field the backend requires', () => {
    expect(Object.keys(validateMetricForm({})).sort()).toEqual(['metric_name', 'metric_value', 'recorded_at', 'unit'])
  })

  it('rejects whitespace-only metric names', () => {
    expect(validateMetricForm({ ...validForm, metric_name: '   ' }).metric_name).toBe('Metric name is required.')
  })

  it('enforces the metric name length limit', () => {
    expect(validateMetricForm({ ...validForm, metric_name: 'x'.repeat(101) }).metric_name).toMatch(/100 characters or fewer/)
    expect(validateMetricForm({ ...validForm, metric_name: 'x'.repeat(100) })).toEqual({})
  })

  it('accepts a complete valid form', () => {
    expect(validateMetricForm(validForm)).toEqual({})
  })

  it('requires a metric value', () => {
    expect(validateMetricForm({ ...validForm, metric_value: '' }).metric_value).toBe('Metric value is required.')
  })

  it('rejects non-numeric metric values', () => {
    expect(validateMetricForm({ ...validForm, metric_value: 'abc' }).metric_value).toBe('Enter a valid number.')
    expect(validateMetricForm({ ...validForm, metric_value: '1,000' }).metric_value).toBe('Enter a valid number.')
    expect(validateMetricForm({ ...validForm, metric_value: '0x1f' }).metric_value).toBe('Enter a valid decimal number.')
  })

  it('rejects non-finite metric values', () => {
    expect(validateMetricForm({ ...validForm, metric_value: 'NaN' }).metric_value).toMatch(/valid number/)
    expect(validateMetricForm({ ...validForm, metric_value: 'Infinity' }).metric_value).toMatch(/finite/)
    expect(validateMetricForm({ ...validForm, metric_value: '-Infinity' }).metric_value).toMatch(/finite/)
    expect(validateMetricForm({ ...validForm, metric_value: '1e999' }).metric_value).toMatch(/finite/)
  })

  it('keeps metric values inside the NUMERIC(15, 4) column range', () => {
    expect(validateMetricForm({ ...validForm, metric_value: String(METRIC_VALUE_LIMIT) })).toEqual({})
    expect(validateMetricForm({ ...validForm, metric_value: `-${METRIC_VALUE_LIMIT}` })).toEqual({})
    expect(validateMetricForm({ ...validForm, metric_value: '1e12' }).metric_value).toMatch(/must be between/)
  })

  it('accepts negative and scientific notation values', () => {
    expect(validateMetricForm({ ...validForm, metric_value: '-0.0001' })).toEqual({})
    expect(validateMetricForm({ ...validForm, metric_value: '1.5e3' })).toEqual({})
  })

  it('requires a unit and enforces its length limit', () => {
    expect(validateMetricForm({ ...validForm, unit: '  ' }).unit).toBe('Unit is required.')
    expect(validateMetricForm({ ...validForm, unit: 'u'.repeat(UNIT_MAX_LENGTH + 1) }).unit).toMatch(/50 characters or fewer/)
    expect(validateMetricForm({ ...validForm, unit: 'u'.repeat(UNIT_MAX_LENGTH) })).toEqual({})
  })

  it('requires a valid recorded timestamp', () => {
    expect(validateMetricForm({ ...validForm, recorded_at: '' }).recorded_at).toBe('Recorded timestamp is required.')
    expect(validateMetricForm({ ...validForm, recorded_at: 'not-a-date' }).recorded_at).toBe('Enter a valid recorded date and time.')
    expect(validateMetricForm({ ...validForm, recorded_at: '2026-13-45T99:99' }).recorded_at).toBe('Enter a valid recorded date and time.')
  })
})

describe('datetime conversion', () => {
  it('converts a datetime-local value into a UTC instant without shifting the wall clock', () => {
    const iso = toRecordedAtIso('2026-03-04T05:06')
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const parsed = new Date(iso)
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes()]).toEqual([2026, 2, 4, 5, 6])
  })

  it('round-trips between datetime-local and ISO values', () => {
    expect(toDateTimeLocalValue(toRecordedAtIso('2026-03-04T05:06'))).toBe('2026-03-04T05:06')
    expect(toDateTimeLocalValue(new Date(2026, 0, 9, 23, 45).toISOString())).toBe('2026-01-09T23:45')
  })

  it('handles empty and invalid values safely', () => {
    expect(toRecordedAtIso('')).toBe('')
    expect(toRecordedAtIso('   ')).toBe('')
    expect(toRecordedAtIso('nope')).toBe('')
    expect(toDateTimeLocalValue('nope')).toBe('')
    expect(toDateTimeLocalValue(undefined)).toBe('')
  })
})

describe('metric form value mapping', () => {
  it('starts empty so no measurement is invented', () => {
    expect(emptyMetricFormValues).toEqual({ metric_name: '', metric_value: '', unit: '', recorded_at: '' })
    expect(toMetricFormValues(null)).toEqual({ metric_name: '', metric_value: '', unit: '', recorded_at: '' })
  })

  it('maps a stored record back into datetime-local form values', () => {
    const values = toMetricFormValues({
      metric_name: 'soil_ph',
      metric_value: '6.4000',
      unit: 'pH',
      recorded_at: '2026-03-04T05:06:00Z',
    })
    expect(values).toEqual({
      metric_name: 'soil_ph',
      metric_value: '6.4000',
      unit: 'pH',
      recorded_at: toDateTimeLocalValue('2026-03-04T05:06:00Z'),
    })
  })
})

describe('metric payload construction', () => {
  it('builds exactly the fields the backend create schema accepts', () => {
    const payload = toMetricPayload({ ...validForm, metric_name: '  carbon_stock  ', unit: ' tonnes ' })
    expect(Object.keys(payload).sort()).toEqual(['metric_name', 'metric_value', 'recorded_at', 'unit'])
    expect(payload.metric_name).toBe('carbon_stock')
    expect(payload.unit).toBe('tonnes')
    expect(payload.metric_value).toBe(128.45)
    expect(typeof payload.metric_value).toBe('number')
    expect(payload.recorded_at).toBe(toRecordedAtIso(validForm.recorded_at))
  })

  it('never submits ownership or server-generated fields', () => {
    const payload = toMetricPayload({ ...validForm, site_id: 'attacker', project_id: 'attacker', id: 'attacker', created_at: '2026-01-01T00:00:00Z' })
    expect(payload).not.toHaveProperty('site_id')
    expect(payload).not.toHaveProperty('project_id')
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('created_at')
  })

  it('never invents a timestamp when the input is empty or invalid', () => {
    expect(toMetricPayload({ ...validForm, recorded_at: '' }).recorded_at).toBe('')
    expect(toMetricPayload({ ...validForm, recorded_at: 'nope' }).recorded_at).toBe('')
  })
})

describe('metric formatting', () => {
  it('preserves column precision while formatting values', () => {
    expect(formatMetricValue('10.5000')).toBe('10.5')
    expect(formatMetricValue(12345.6789)).toBe('12,345.6789')
    expect(formatMetricValue('22.1558')).toBe('22.1558')
  })

  it('labels unusable values instead of rendering NaN', () => {
    expect(formatMetricValue(null)).toBe('Unavailable')
    expect(formatMetricValue('')).toBe('Unavailable')
    expect(formatMetricValue('not-a-number')).toBe('Unavailable')
    expect(formatMetricValue(Number.POSITIVE_INFINITY)).toBe('Unavailable')
  })

  it('formats timestamps and labels invalid ones', () => {
    expect(formatMetricTimestamp(undefined)).toBe('—')
    expect(formatMetricTimestamp('nope')).toBe('Unavailable')
    expect(formatMetricTimestamp('2026-03-04T05:06:00Z')).toMatch(/2026/)
  })
})

describe('metric record ordering', () => {
  it('sorts records newest first using the id as a tie-breaker', () => {
    const sorted = sortMetricsNewestFirst([
      { id: 'a', recorded_at: '2026-01-01T00:00:00Z' },
      { id: 'c', recorded_at: '2026-02-01T00:00:00Z' },
      { id: 'b', recorded_at: '2026-02-01T00:00:00Z' },
    ])
    expect(sorted.map((record) => record.id)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate the input array', () => {
    const records = [{ id: 'a', recorded_at: '2026-01-01T00:00:00Z' }, { id: 'b', recorded_at: '2026-02-01T00:00:00Z' }]
    sortMetricsNewestFirst(records)
    expect(records.map((record) => record.id)).toEqual(['a', 'b'])
  })

  it('survives records with unusable timestamps', () => {
    const records = [{ id: 'a', recorded_at: 'nope' }, { id: 'b', recorded_at: '2026-02-01T00:00:00Z' }]
    expect(() => sortMetricsNewestFirst(records)).not.toThrow()
    expect(sortMetricsNewestFirst(records)).toHaveLength(2)
  })
})

describe('API error mapping', () => {
  it('maps FastAPI validation errors onto form fields', () => {
    const fieldErrors = toFieldErrors({
      response: {
        data: {
          detail: [
            { loc: ['body', 'metric_name'], msg: 'Value error, metric_name must not be empty' },
            { loc: ['body', 'unit'], msg: 'Field required' },
            { loc: ['body', 'metric_name'], msg: 'ignored duplicate' },
          ],
        },
      },
    })
    expect(fieldErrors).toEqual({ metric_name: 'metric_name must not be empty', unit: 'Field required' })
  })

  it('ignores errors that are not field-level', () => {
    expect(toFieldErrors({ response: { data: { detail: 'Site not found.' } } })).toEqual({})
    expect(toFieldErrors({ response: { data: {} } })).toEqual({})
    expect(toFieldErrors(undefined)).toEqual({})
  })
})