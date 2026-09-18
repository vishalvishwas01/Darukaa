/**
 * Dependency-free checks for the metric helper module.
 *
 * The client has no test runner installed (no vitest/jest), so these pure helpers are verified
 * with plain Node assertions: `npm test` or `npm run test:metric-helpers`.
 * No backend or Mapbox token is required.
 */
import assert from 'node:assert/strict'
import {
  formatMetricTimestamp,
  formatMetricValue,
  METRIC_VALUE_LIMIT,
  sortMetricsNewestFirst,
  toDateTimeLocalValue,
  toFieldErrors,
  toMetricPayload,
  toRecordedAtIso,
  validateMetricForm,
} from '../src/features/metrics/utils/metricFormat.js'

const results = []

const test = (name, run) => {
  try {
    run()
    results.push({ name, passed: true })
  } catch (error) {
    results.push({ name, passed: false, message: error.message })
  }
}

const validForm = {
  metric_name: 'carbon_stock',
  metric_value: '128.45',
  unit: 'tonnes',
  recorded_at: '2026-03-04T05:06',
}

test('1. required-field validation rejects an empty form', () => {
  const errors = validateMetricForm({})
  assert.deepEqual(Object.keys(errors).sort(), ['metric_name', 'metric_value', 'recorded_at', 'unit'])
})

test('2. required-field validation rejects whitespace-only names', () => {
  const errors = validateMetricForm({ ...validForm, metric_name: '   ' })
  assert.equal(errors.metric_name, 'Metric name is required.')
})

test('3. required-field validation accepts a complete form', () => {
  assert.deepEqual(validateMetricForm(validForm), {})
})

test('4. numeric validation rejects non-numeric input', () => {
  assert.equal(validateMetricForm({ ...validForm, metric_value: 'abc' }).metric_value, 'Enter a valid number.')
  assert.equal(validateMetricForm({ ...validForm, metric_value: '1,000' }).metric_value, 'Enter a valid number.')
})

test('5. numeric validation rejects non-finite values', () => {
  assert.match(validateMetricForm({ ...validForm, metric_value: 'NaN' }).metric_value, /valid number/)
  assert.match(validateMetricForm({ ...validForm, metric_value: 'Infinity' }).metric_value, /finite/)
  assert.match(validateMetricForm({ ...validForm, metric_value: '-Infinity' }).metric_value, /finite/)
  assert.match(validateMetricForm({ ...validForm, metric_value: '1e999' }).metric_value, /finite/)
})

test('6. numeric validation enforces the NUMERIC(15,4) column range', () => {
  assert.deepEqual(validateMetricForm({ ...validForm, metric_value: String(METRIC_VALUE_LIMIT) }), {})
  assert.match(validateMetricForm({ ...validForm, metric_value: '1e12' }).metric_value, /must be between/)
})

test('7. numeric validation accepts negative and scientific notation', () => {
  assert.deepEqual(validateMetricForm({ ...validForm, metric_value: '-0.0001' }), {})
  assert.deepEqual(validateMetricForm({ ...validForm, metric_value: '1.5e3' }), {})
})

test('8. timestamp validation rejects missing and invalid values', () => {
  assert.equal(validateMetricForm({ ...validForm, recorded_at: '' }).recorded_at, 'Recorded timestamp is required.')
  assert.equal(validateMetricForm({ ...validForm, recorded_at: 'not-a-date' }).recorded_at, 'Enter a valid recorded date and time.')
  assert.equal(validateMetricForm({ ...validForm, recorded_at: '2026-13-45T99:99' }).recorded_at, 'Enter a valid recorded date and time.')
})

test('9. length limits mirror the backend schema', () => {
  assert.ok(validateMetricForm({ ...validForm, metric_name: 'x'.repeat(101) }).metric_name)
  assert.equal(validateMetricForm({ ...validForm, metric_name: 'x'.repeat(100) }).metric_name, undefined)
  assert.ok(validateMetricForm({ ...validForm, unit: 'u'.repeat(51) }).unit)
})

test('10. datetime conversion produces a UTC instant without shifting the wall clock', () => {
  const iso = toRecordedAtIso('2026-03-04T05:06')
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  const parsed = new Date(iso)
  assert.equal(parsed.getFullYear(), 2026)
  assert.equal(parsed.getMonth(), 2)
  assert.equal(parsed.getDate(), 4)
  assert.equal(parsed.getHours(), 5)
  assert.equal(parsed.getMinutes(), 6)
  assert.equal(parsed.getSeconds(), 0)
})

test('11. datetime conversion round-trips through the datetime-local input', () => {
  assert.equal(toDateTimeLocalValue(toRecordedAtIso('2026-03-04T05:06')), '2026-03-04T05:06')
  assert.equal(toDateTimeLocalValue(new Date(2026, 0, 9, 23, 45).toISOString()), '2026-01-09T23:45')
})

test('12. datetime conversion is safe for empty and invalid input', () => {
  assert.equal(toRecordedAtIso(''), '')
  assert.equal(toRecordedAtIso('   '), '')
  assert.equal(toRecordedAtIso('nope'), '')
  assert.equal(toDateTimeLocalValue('nope'), '')
  assert.equal(toDateTimeLocalValue(undefined), '')
})

test('13. payload construction matches the backend create schema', () => {
  const payload = toMetricPayload({ ...validForm, metric_name: '  carbon_stock  ', unit: ' tonnes ' })
  assert.deepEqual(Object.keys(payload).sort(), ['metric_name', 'metric_value', 'recorded_at', 'unit'])
  assert.equal(payload.metric_name, 'carbon_stock')
  assert.equal(payload.unit, 'tonnes')
  assert.equal(payload.metric_value, 128.45)
  assert.equal(typeof payload.metric_value, 'number')
  assert.equal(payload.recorded_at, toRecordedAtIso(validForm.recorded_at))
  assert.equal('site_id' in payload, false)
  assert.equal('id' in payload, false)
  assert.equal('created_at' in payload, false)
})

test('14. payload construction never invents a timestamp', () => {
  assert.equal(toMetricPayload({ ...validForm, recorded_at: '' }).recorded_at, '')
  assert.equal(toMetricPayload({ ...validForm, recorded_at: 'nope' }).recorded_at, '')
})

test('15. API validation errors map onto form fields', () => {
  const fieldErrors = toFieldErrors({
    response: { data: { detail: [{ loc: ['body', 'metric_name'], msg: 'Value error, metric_name must not be empty' }, { loc: ['body', 'unit'], msg: 'Field required' }] } },
  })
  assert.deepEqual(fieldErrors, { metric_name: 'metric_name must not be empty', unit: 'Field required' })
  assert.deepEqual(toFieldErrors({ response: { data: { detail: 'Site not found.' } } }), {})
  assert.deepEqual(toFieldErrors(undefined), {})
})

test('16. records sort newest first with an id tie-breaker', () => {
  const sorted = sortMetricsNewestFirst([
    { id: 'a', recorded_at: '2026-01-01T00:00:00Z' },
    { id: 'c', recorded_at: '2026-02-01T00:00:00Z' },
    { id: 'b', recorded_at: '2026-02-01T00:00:00Z' },
  ])
  assert.deepEqual(sorted.map((record) => record.id), ['c', 'b', 'a'])
})

test('17. value formatting preserves column precision and survives bad data', () => {
  assert.equal(formatMetricValue('10.5000'), '10.5')
  assert.equal(formatMetricValue(12345.6789), '12,345.6789')
  assert.equal(formatMetricValue(null), 'Unavailable')
  assert.equal(formatMetricValue('not-a-number'), 'Unavailable')
  assert.equal(formatMetricValue(Number.POSITIVE_INFINITY), 'Unavailable')
})

test('18. timestamp formatting labels invalid values instead of rendering NaN', () => {
  assert.equal(formatMetricTimestamp(undefined), '—')
  assert.equal(formatMetricTimestamp('nope'), 'Unavailable')
  assert.match(formatMetricTimestamp('2026-03-04T05:06:00Z'), /2026/)
})

const failures = results.filter((result) => !result.passed)
results.forEach((result) => {
  console.log(`${result.passed ? 'ok  ' : 'FAIL'} - ${result.name}${result.passed ? '' : `\n        ${result.message}`}`)
})
console.log(`\n${results.length - failures.length}/${results.length} metric helper checks passed.`)
process.exitCode = failures.length === 0 ? 0 : 1
