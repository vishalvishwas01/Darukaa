import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSiteAnalyticsSummary, getSiteTimeSeries } from '../../../api/analyticsApi'
import { normalizeApiError } from '../../../services/api'
import AnalyticsSummaryCards from './AnalyticsSummaryCards'
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading } from './AnalyticsState'
import TimeSeriesChart from './TimeSeriesChart'
import { dateRangeParams, formatAnalyticsDate, formatMetricValue, validateDateRange } from '../utils/analyticsFormat'

export default function SiteAnalyticsSection({ projectId, siteId }) {
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [series, setSeries] = useState(null)
  const [seriesError, setSeriesError] = useState('')
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('')
  const [draftRange, setDraftRange] = useState({ startDate: '', endDate: '' })
  const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' })
  const [rangeError, setRangeError] = useState('')

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const response = await getSiteAnalyticsSummary(projectId, siteId)
      setSummary(response.data)
    } catch (requestError) {
      setSummaryError(normalizeApiError(requestError))
    } finally {
      setSummaryLoading(false)
    }
  }, [projectId, siteId])

  useEffect(() => {
    const load = async () => loadSummary()
    load()
  }, [loadSummary])

  const availableMetrics = summary?.available_metric_names || []
  const activeMetric = availableMetrics.includes(selectedMetric) ? selectedMetric : availableMetrics[0] || ''

  const loadSeries = useCallback(async () => {
    if (!activeMetric) {
      setSeries(null)
      return
    }
    setSeriesLoading(true)
    setSeriesError('')
    try {
      const response = await getSiteTimeSeries(projectId, siteId, {
        metric_name: activeMetric,
        ...dateRangeParams(appliedRange.startDate, appliedRange.endDate),
      })
      setSeries(response.data)
    } catch (requestError) {
      setSeriesError(normalizeApiError(requestError))
      setSeries(null)
    } finally {
      setSeriesLoading(false)
    }
  }, [activeMetric, appliedRange.endDate, appliedRange.startDate, projectId, siteId])

  useEffect(() => {
    const load = async () => loadSeries()
    load()
  }, [loadSeries])

  const activeSummary = useMemo(() => summary?.metrics?.find((metric) => metric.metric_name === activeMetric), [activeMetric, summary])

  const applyRange = (event) => {
    event.preventDefault()
    const message = validateDateRange(draftRange.startDate, draftRange.endDate)
    if (message) {
      setRangeError(message)
      return
    }
    setRangeError('')
    setAppliedRange(draftRange)
  }

  const clearRange = () => {
    setDraftRange({ startDate: '', endDate: '' })
    setAppliedRange({ startDate: '', endDate: '' })
    setRangeError('')
  }

  return <section className="analytics-section">
    <div className="analytics-section-heading"><div><span className="eyebrow">Site analytics</span><h2>Performance over time</h2><p>Measured records from this site, with no synthetic values.</p></div></div>
    {summaryLoading && <AnalyticsLoading label="Loading site summary..." />}
    {!summaryLoading && summaryError && <AnalyticsError message={summaryError} onRetry={loadSummary} />}
    {!summaryLoading && !summaryError && summary && summary.total_metric_records === 0 && <AnalyticsEmpty>No metric records are available for this site yet.</AnalyticsEmpty>}
    {!summaryLoading && !summaryError && summary && summary.total_metric_records > 0 && <>
      <AnalyticsSummaryCards summary={summary} />
      <div className="analytics-workbench">
        <div className="analytics-controls">
          <label className="field-label" htmlFor="metric-selector">Metric</label>
          <select id="metric-selector" className="text-input" value={activeMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
            {availableMetrics.map((metricName) => <option key={metricName} value={metricName}>{metricName}</option>)}
          </select>
          {activeSummary && <span className="analytics-unit">{activeSummary.unit} · {activeSummary.record_count} records</span>}
        </div>
        <form className="date-filter" onSubmit={applyRange}>
          <div><label className="field-label" htmlFor="analytics-start">Start date</label><input id="analytics-start" className="text-input" type="date" value={draftRange.startDate} onChange={(event) => setDraftRange((current) => ({ ...current, startDate: event.target.value }))} /></div>
          <div><label className="field-label" htmlFor="analytics-end">End date</label><input id="analytics-end" className="text-input" type="date" value={draftRange.endDate} onChange={(event) => setDraftRange((current) => ({ ...current, endDate: event.target.value }))} /></div>
          <button className="secondary-button" type="submit">Apply</button><button className="text-button" type="button" onClick={clearRange}>Clear</button>
        </form>
      </div>
      {rangeError && <div className="form-alert" role="alert">{rangeError}</div>}
      {seriesLoading && <AnalyticsLoading label="Loading time-series..." />}
      {!seriesLoading && seriesError && <AnalyticsError message={seriesError} onRetry={loadSeries} />}
      {!seriesLoading && !seriesError && series && series.points.length === 0 && <AnalyticsEmpty>No points match this metric and date range.</AnalyticsEmpty>}
      {!seriesLoading && !seriesError && series?.points?.length > 0 && <TimeSeriesChart series={series} />}
      {series?.points?.length > 0 && <div className="analytics-range-note">Showing {formatAnalyticsDate(series.points[0].recorded_at)} to {formatAnalyticsDate(series.points[series.points.length - 1].recorded_at)} · latest {formatMetricValue(activeSummary?.latest_value)} {activeSummary?.unit || series.unit || ''}</div>}
      <div className="metric-summary-table"><div className="table-heading"><span>Metric summary</span><span>{summary.latest_recorded_at ? `Latest record ${formatAnalyticsDate(summary.latest_recorded_at)}` : ''}</span></div>{summary.metrics.map((metric) => <div className="metric-summary-row" key={`${metric.metric_name}-${metric.unit}`}><strong>{metric.metric_name}</strong><span>{metric.unit}</span><span>min {formatMetricValue(metric.minimum_value)}</span><span>max {formatMetricValue(metric.maximum_value)}</span><span>avg {formatMetricValue(metric.average_value)}</span></div>)}</div>
    </>}
  </section>
}
