export const formatAnalyticsDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
}

export const formatMetricValue = (value, maximumFractionDigits = 2) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Unavailable'
  return new Intl.NumberFormat('en', { maximumFractionDigits }).format(number)
}

export const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate && startDate > endDate) return 'Start date must be before or equal to the end date.'
  return ''
}

export const dateRangeParams = (startDate, endDate) => ({
  ...(startDate ? { start_date: `${startDate}T00:00:00Z` } : {}),
  ...(endDate ? { end_date: `${endDate}T23:59:59.999Z` } : {}),
})

export const toTimeSeriesChartData = (series) => {
  const points = Array.isArray(series?.points) ? series.points : []
  const validPoints = points.filter((point) => point && !Number.isNaN(new Date(point.recorded_at).getTime()) && Number.isFinite(Number(point.value)))
  return {
    labels: validPoints.map((point) => formatAnalyticsDate(point.recorded_at)),
    datasets: [{
      label: series?.unit ? `${series.metric_name} (${series.unit})` : series?.metric_name || 'Metric',
      data: validPoints.map((point) => Number(point.value)),
      borderColor: '#35634d',
      backgroundColor: 'rgba(200, 232, 107, .34)',
      pointBackgroundColor: '#35634d',
      pointRadius: validPoints.length === 1 ? 5 : 3,
      pointHoverRadius: 6,
      tension: 0.25,
      fill: true,
    }],
  }
}
