import { useEffect, useRef } from 'react'
import { Chart as ChartJS, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { toTimeSeriesChartData } from '../utils/analyticsFormat'

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

export default function TimeSeriesChart({ series }) {
  const chartRef = useRef(null)
  const chartData = toTimeSeriesChartData(series)
  const values = chartData.datasets[0].data

  useEffect(() => () => chartRef.current?.destroy?.(), [])

  if (!values.length) return null

  return <div className="analytics-chart-wrap" aria-label={`${series.metric_name} time-series chart`}>
    <Line
      ref={chartRef}
      data={chartData}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: true, labels: { color: '#536158', boxWidth: 12, font: { family: 'ui-sans-serif, system-ui' } } },
          tooltip: { callbacks: { label: (context) => `${context.parsed.y} ${series.unit || ''}`.trim() } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b766e', maxTicksLimit: 6 } },
          y: { grid: { color: '#e1e7de' }, ticks: { color: '#6b766e' } },
        },
      }}
    />
    <p className="chart-summary">{values.length} recorded point{values.length === 1 ? '' : 's'} shown for {series.metric_name}{series.unit ? ` in ${series.unit}` : ''}.</p>
  </div>
}
