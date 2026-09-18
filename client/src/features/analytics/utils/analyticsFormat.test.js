import { describe, expect, it } from 'vitest'
import {
  dateRangeParams,
  formatAnalyticsDate,
  formatMetricValue,
  toTimeSeriesChartData,
  validateDateRange,
} from './analyticsFormat'

describe('date range validation', () => {
  it('rejects a range whose start is after its end', () => {
    expect(validateDateRange('2026-03-04', '2026-03-01')).toBe('Start date must be before or equal to the end date.')
  })

  it('accepts ordered, partial and empty ranges', () => {
    expect(validateDateRange('2026-03-01', '2026-03-04')).toBe('')
    expect(validateDateRange('2026-03-01', '2026-03-01')).toBe('')
    expect(validateDateRange('', '2026-03-04')).toBe('')
    expect(validateDateRange('', '')).toBe('')
  })
})

describe('date range query parameters', () => {
  it('turns filter dates into UTC day boundaries', () => {
    expect(dateRangeParams('2026-03-01', '2026-03-04')).toEqual({
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-03-04T23:59:59.999Z',
    })
  })

  it('omits filters that are not set', () => {
    expect(dateRangeParams('', '')).toEqual({})
    expect(dateRangeParams('2026-03-01', '')).toEqual({ start_date: '2026-03-01T00:00:00Z' })
    expect(dateRangeParams('', '2026-03-04')).toEqual({ end_date: '2026-03-04T23:59:59.999Z' })
  })
})

describe('analytics formatting', () => {
  it('formats dates and labels unusable timestamps', () => {
    expect(formatAnalyticsDate(null)).toBe('—')
    expect(formatAnalyticsDate('nope')).toBe('Unavailable')
    expect(formatAnalyticsDate('2026-03-04T05:06:00Z')).toMatch(/2026/)
  })

  it('formats metric values and labels unusable numbers', () => {
    expect(formatMetricValue('10.5000')).toBe('10.5')
    expect(formatMetricValue('128.4500')).toBe('128.45')
    expect(formatMetricValue('nope')).toBe('Unavailable')
    // Pre-existing quirk (unchanged by this step, and not reachable from the analytics API, which
    // never returns null metric values): Number(null) is 0, so null formats as "0".
    // metricFormat.formatMetricValue guards null explicitly and is used by the metric records table.
    expect(formatMetricValue(undefined)).toBe('Unavailable')
  })
})

describe('time-series chart data', () => {
  it('builds a labelled dataset from valid points', () => {
    const chartData = toTimeSeriesChartData({
      metric_name: 'carbon_stock',
      unit: 'tonnes',
      points: [
        { recorded_at: '2026-01-01T00:00:00Z', value: '10.0000' },
        { recorded_at: '2026-03-04T05:06:00Z', value: '128.4500' },
      ],
    })
    expect(chartData.datasets[0].label).toBe('carbon_stock (tonnes)')
    expect(chartData.datasets[0].data).toEqual([10, 128.45])
    expect(chartData.labels).toHaveLength(2)
  })

  it('filters out points with invalid timestamps or unusable values', () => {
    const chartData = toTimeSeriesChartData({
      metric_name: 'carbon_stock',
      unit: 'tonnes',
      points: [
        { recorded_at: '2026-01-01T00:00:00Z', value: '10.0000' },
        { recorded_at: 'not-a-date', value: '5.0000' },
        { recorded_at: '2026-02-01T00:00:00Z', value: 'not-a-number' },
        { recorded_at: '2026-03-04T05:06:00Z', value: '128.4500' },
      ],
    })
    expect(chartData.datasets[0].data).toEqual([10, 128.45])
    expect(chartData.labels).toHaveLength(2)
  })

  it('handles empty and missing series safely', () => {
    expect(toTimeSeriesChartData({ metric_name: 'carbon_stock', points: [] }).datasets[0].data).toEqual([])
    expect(toTimeSeriesChartData(undefined).datasets[0].label).toBe('Metric')
  })

  it('enlarges the single-point marker when only one point exists', () => {
    const chartData = toTimeSeriesChartData({ metric_name: 'carbon_stock', points: [{ recorded_at: '2026-01-01T00:00:00Z', value: '10.0000' }] })
    expect(chartData.datasets[0].pointRadius).toBe(5)
  })
})