import { Activity, CalendarDays, Gauge, Layers3 } from 'lucide-react'
import { formatAnalyticsDate, formatMetricValue } from '../utils/analyticsFormat'

export default function AnalyticsSummaryCards({ summary }) {
  const firstMetric = summary?.metrics?.[0]
  const cards = [
    { icon: Activity, label: 'Metric records', value: summary?.total_metric_records ? formatMetricValue(summary.total_metric_records, 0) : '—' },
    { icon: Layers3, label: 'Metric types', value: summary?.available_metric_names?.length ? formatMetricValue(summary.available_metric_names.length, 0) : '—' },
    { icon: CalendarDays, label: 'First recorded', value: formatAnalyticsDate(summary?.earliest_recorded_at) },
    { icon: Gauge, label: firstMetric ? `Latest ${firstMetric.metric_name}` : 'Latest value', value: firstMetric ? `${formatMetricValue(firstMetric.latest_value)} ${firstMetric.unit}` : '—' },
  ]

  return <div className="analytics-summary-grid">{cards.map(({ icon: Icon, label, value }) => <article className="analytics-summary-card" key={label}><Icon size={18} /><span>{label}</span><strong>{value}</strong></article>)}</div>
}
