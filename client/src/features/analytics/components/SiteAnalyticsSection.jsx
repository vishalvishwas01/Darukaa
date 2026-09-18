import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSiteAnalyticsSummary, getSiteTimeSeries } from '../../../api/analyticsApi'
import { normalizeApiError } from '../../../services/api'
import AnalyticsSummaryCards from './AnalyticsSummaryCards'
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading } from './AnalyticsState'
import TimeSeriesChart from './TimeSeriesChart'
import { dateRangeParams, formatAnalyticsDate, formatMetricValue, validateDateRange } from '../utils/analyticsFormat'

/**
 * `refreshToken` is bumped by the parent after a metric record is created, updated or deleted.
 * `preferredMetric` lets a newly created metric name become the selected metric.
 * Both are optional so the section keeps working standalone.
 */
export default function SiteAnalyticsSection({ projectId, siteId, refreshToken = 0, preferredMetric = '' }) {
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [series, setSeries] = useState(null)
  const [seriesError, setSeriesError] = useState('')
  const [seriesLoading, setSeriesLoading] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState('')
  const [dismissedHint, setDismissedHint] = useState('')
  const [draftRange, setDraftRange] = useState({ startDate: '', endDate: '' })
  const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' })
  const [rangeError, setRangeError] = useState('')
  const hasSummaryRef = useRef(false)
  const lastRefreshTokenRef = useRef(0)
  const summaryRequestRef = useRef(0)
  const seriesRequestRef = useRef(0)

  const loadSummary = useCallback(async () => {
    const requestId = summaryRequestRef.current + 1
    summaryRequestRef.current = requestId
    setSummaryError('')
    setSummaryLoading(!hasSummaryRef.current)
    setIsRefreshing(true)
    try {
      const response = await getSiteAnalyticsSummary(projectId, siteId)
      if (requestId !== summaryRequestRef.current) return
      hasSummaryRef.current = true
      setSummary(response.data)
    } catch (requestError) {
      if (requestId !== summaryRequestRef.current) return
      setSummaryError(normalizeApiError(requestError))
    } finally {
      if (requestId === summaryRequestRef.current) {
        setSummaryLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [projectId, siteId])

  useEffect(() => {
    const load = async () => loadSummary()
    load()
  }, [loadSummary])

  // A metric mutation refreshes the summary; the rebuilt metric list then refreshes the chart.
  useEffect(() => {
    if (refreshToken === lastRefreshTokenRef.current) return
    lastRefreshTokenRef.current = refreshToken
    const refresh = async () => { await loadSummary() }
    refresh()
  }, [loadSummary, refreshToken])

  // Memoized so the chart request below is only rebuilt when the summary actually changes.
  const availableMetrics = useMemo(() => summary?.available_metric_names || [], [summary])

  // A newly created or edited metric is offered as a hint; choosing a metric manually dismisses it.
  const activeMetric = useMemo(() => {
    if (preferredMetric && preferredMetric !== dismissedHint && availableMetrics.includes(preferredMetric)) return preferredMetric
    return availableMetrics.includes(selectedMetric) ? selectedMetric : availableMetrics[0] || ''
  }, [availableMetrics, dismissedHint, preferredMetric, selectedMetric])

  // Rebuilt whenever the site's metric summary changes (so also after a mutation), which refetches
  // the chart with the preserved metric selection and date range.
  const seriesParams = useMemo(() => ({
    metric_name: availableMetrics.includes(activeMetric) ? activeMetric : '',
    ...dateRangeParams(appliedRange.startDate, appliedRange.endDate),
  }), [activeMetric, appliedRange.endDate, appliedRange.startDate, availableMetrics])

  const selectMetric = (metricName) => {
    setDismissedHint(preferredMetric)
    setSelectedMetric(metricName)
  }

  const loadSeries = useCallback(async () => {
    const requestId = seriesRequestRef.current + 1
    seriesRequestRef.current = requestId
    if (!seriesParams.metric_name) {
      setSeries(null)
      return
    }
    setSeriesLoading(true)
    setSeriesError('')
    try {
      const response = await getSiteTimeSeries(projectId, siteId, seriesParams)
      if (requestId !== seriesRequestRef.current) return
      setSeries(response.data)
    } catch (requestError) {
      if (requestId !== seriesRequestRef.current) return
      setSeriesError(normalizeApiError(requestError))
      setSeries(null)
    } finally {
      if (requestId === seriesRequestRef.current) setSeriesLoading(false)
    }
  }, [projectId, seriesParams, siteId])

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
    {isRefreshing && !summaryLoading && <p className="analytics-refreshing" role="status">Refreshing analytics after the metric change...</p>}
    {summaryLoading && <AnalyticsLoading label="Loading site summary..." />}
    {!summaryLoading && summaryError && <AnalyticsError message={summaryError} onRetry={loadSummary} />}
    {!summaryLoading && !summaryError && summary && summary.total_metric_records === 0 && <AnalyticsEmpty>No metric records are available for this site yet.</AnalyticsEmpty>}
    {!summaryLoading && !summaryError && summary && summary.total_metric_records > 0 && <>
      <AnalyticsSummaryCards summary={summary} />
      <div className="analytics-workbench">
        <div className="analytics-controls">
          <label className="field-label" htmlFor="metric-selector">Metric</label>
          <select id="metric-selector" className="text-input" value={activeMetric} onChange={(event) => selectMetric(event.target.value)}>
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
