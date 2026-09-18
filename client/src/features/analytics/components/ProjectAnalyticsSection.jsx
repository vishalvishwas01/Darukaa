import { useCallback, useEffect, useState } from 'react'
import { getProjectAnalyticsSummary } from '../../../api/analyticsApi'
import { normalizeApiError } from '../../../services/api'
import AnalyticsSummaryCards from './AnalyticsSummaryCards'
import { AnalyticsEmpty, AnalyticsError, AnalyticsLoading } from './AnalyticsState'
import { formatAnalyticsDate, formatMetricValue } from '../utils/analyticsFormat'

export default function ProjectAnalyticsSection({ projectId }) {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await getProjectAnalyticsSummary(projectId)
      setSummary(response.data)
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    const fetchSummary = async () => load()
    fetchSummary()
  }, [load])

  return <section className="analytics-section project-analytics-section">
    <div className="analytics-section-heading"><div><span className="eyebrow">Project analytics</span><h2>Evidence across the project</h2><p>Aggregates from the project’s saved site metrics.</p></div></div>
    {isLoading && <AnalyticsLoading label="Loading project summary..." />}
    {!isLoading && error && <AnalyticsError message={error} onRetry={load} />}
    {!isLoading && !error && summary && summary.total_metric_records === 0 && <AnalyticsEmpty>No metric records are available across this project yet.</AnalyticsEmpty>}
    {!isLoading && !error && summary && summary.total_metric_records > 0 && <>
      <AnalyticsSummaryCards summary={summary} />
      <div className="project-metric-list">{summary.metrics.map((metric) => <div className="project-metric-row" key={`${metric.metric_name}-${metric.unit}`}><div><strong>{metric.metric_name}</strong><span>{metric.unit}</span></div><span>{metric.record_count} records</span><strong>{formatMetricValue(metric.latest_value)} {metric.unit}</strong></div>)}</div>
      <div className="site-count-list"><div className="table-heading"><span>Records by site</span><span>{summary.total_sites} sites</span></div>{summary.site_record_counts.map((site) => <div className="metric-summary-row" key={site.site_id}><strong>{site.site_id}</strong><span>{site.record_count} records</span></div>)}</div>
      <p className="analytics-range-note">Latest project metric record: {summary.metrics[0]?.latest_recorded_at ? formatAnalyticsDate(summary.metrics[0].latest_recorded_at) : 'Unavailable'}.</p>
    </>}
  </section>
}
