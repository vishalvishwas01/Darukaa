/**
 * Integration-style test for the principal metric-entry -> analytics-refresh flow.
 *
 * Scope: renders `SiteMetricRecords` (which embeds MetricForm + ConfirmDialog + table)
 * together with `SiteAnalyticsSection` sharing the same `onMetricsChanged` callback
 * used by SiteDetails. No Mapbox, no router, no real HTTP.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMetric, deleteMetric, listMetrics } from '../../../api/metricApi'
import { getSiteAnalyticsSummary, getSiteTimeSeries } from '../../../api/analyticsApi'
import {
  metricPage,
  metricRecord,
  PROJECT_ID,
  SITE_ID,
  siteSummary,
  timeSeries,
} from '../../../test/fixtures'
import SiteAnalyticsSection from '../../analytics/components/SiteAnalyticsSection'
import SiteMetricRecords from './SiteMetricRecords'

vi.mock('../../../api/metricApi', () => ({
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  deleteMetric: vi.fn(),
  listMetrics: vi.fn(),
}))

vi.mock('../../../api/analyticsApi', () => ({
  getSiteAnalyticsSummary: vi.fn(),
  getSiteTimeSeries: vi.fn(),
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: vi.fn(),
  Filler: vi.fn(),
  Legend: vi.fn(),
  LinearScale: vi.fn(),
  LineElement: vi.fn(),
  PointElement: vi.fn(),
  Tooltip: vi.fn(),
}))

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div data-testid="line-chart" data-label={data?.datasets?.[0]?.label || ''} />
  ),
}))

// Mirrors the SiteDetails composition: records + analytics share the same
// onMetricsChanged callback that bumps the refresh token.
function SiteDetailsStub({ analyticsRefreshToken, preferredMetric, onMetricsChanged }) {
  return (
    <>
      <SiteMetricRecords
        projectId={PROJECT_ID}
        siteId={SITE_ID}
        onMetricsChanged={onMetricsChanged}
      />
      <SiteAnalyticsSection
        projectId={PROJECT_ID}
        siteId={SITE_ID}
        refreshToken={analyticsRefreshToken}
        preferredMetric={preferredMetric}
      />
    </>
    )
}

describe('Metric entry → analytics refresh flow', () => {
  beforeEach(() => {
    createMetric.mockReset()
    deleteMetric.mockReset()
    listMetrics.mockReset()
    getSiteAnalyticsSummary.mockReset()
    getSiteTimeSeries.mockReset()
  })

  it('creating a metric record triggers analytics refresh', async () => {
    const user = userEvent.setup()

    listMetrics.mockResolvedValue({ data: metricPage([]) })
    getSiteAnalyticsSummary.mockResolvedValue({ data: siteSummary({ total_metric_records: 0, available_metric_names: [] }) })
    getSiteTimeSeries.mockResolvedValue({ data: timeSeries({ points: [] }) })

    const metricsChanged = vi.fn()

    const { rerender } = render(
      <SiteDetailsStub analyticsRefreshToken={0} preferredMetric="" onMetricsChanged={metricsChanged} />,
    )

    // Initial analytics load (empty).
    expect(await screen.findByText('Loading site summary...')).toBeInTheDocument()

    // Open the form.
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))
    expect(screen.getByRole('dialog', { name: 'Add metric record' })).toBeInTheDocument()

    // Fill in the form.
    await user.type(screen.getByLabelText('Metric name'), 'temperature')
    await user.type(screen.getByLabelText('Metric value'), '23.5')
    await user.type(screen.getByLabelText('Unit'), 'celsius')
    await user.type(screen.getByLabelText('Recorded timestamp'), '2026-05-01T10:30')

    // Mock the successful create response.
    createMetric.mockResolvedValue({
      data: metricRecord({ metric_name: 'temperature', metric_value: '23.5000', unit: 'celsius' }),
    })
    listMetrics.mockResolvedValue({
      data: metricPage([metricRecord({ metric_name: 'temperature', metric_value: '23.5000', unit: 'celsius' })]),
    })

    // Submit the form.
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    // 1. The create API was called with a server-safe payload.
    await waitFor(() => {
      expect(createMetric).toHaveBeenCalledTimes(1)
    })
    const sentPayload = createMetric.mock.calls[0][2]
    expect(sentPayload).toEqual({
      metric_name: 'temperature',
      metric_value: '23.5000',
      unit: 'celsius',
      recorded_at: '2026-05-01T05:00:00.000Z',
    })
    expect(sentPayload).not.toHaveProperty('site_id')
    expect(sentPayload).not.toHaveProperty('project_id')
    expect(sentPayload).not.toHaveProperty('id')
    expect(sentPayload).not.toHaveProperty('created_at')

    // 2. Success feedback appears.
    expect(await screen.findByText('temperature (celsius) was added.')).toBeInTheDocument()

    // 3. The records list refreshes and shows the new record.
    await waitFor(() => {
      expect(screen.getByText('temperature')).toBeInTheDocument()
    })

    // 4. The onMetricsChanged callback fires with the new metric name.
    expect(metricsChanged).toHaveBeenCalledWith('temperature')

    // 5. Simulate SiteDetails bumping the refresh token + preferred metric.
    getSiteAnalyticsSummary.mockResolvedValue({
      data: siteSummary({ total_metric_records: 1, available_metric_names: ['temperature'] }),
    })
    getSiteTimeSeries.mockResolvedValue({
      data: timeSeries({
        metric_name: 'temperature',
        unit: 'celsius',
        points: [{ recorded_at: '2026-05-01T05:00:00Z', value: '23.5000' }],
      }),
    })

        await act(async () => {
      rerender(
        <SiteDetailsStub analyticsRefreshToken={1} preferredMetric="temperature" onMetricsChanged={metricsChanged} />,
      )
    })

    // 6. Analytics refresh and show the new metric in the chart.
    await waitFor(() => {
      expect(getSiteAnalyticsSummary).toHaveBeenCalledTimes(2)
    })

    const chart = await screen.findByTestId('line-chart')
    expect(chart).toHaveAttribute('data-label', 'temperature (celsius)')
  })

  it('deleting a metric record triggers analytics refresh', async () => {
    const user = userEvent.setup()
    const existing = metricRecord({ id: 'del-target', metric_name: 'carbon_stock' })

    listMetrics.mockResolvedValue({ data: metricPage([existing]) })
    getSiteAnalyticsSummary.mockResolvedValue({ data: siteSummary({ total_metric_records: 1 }) })
    getSiteTimeSeries.mockResolvedValue({ data: timeSeries() })

    const metricsChanged = vi.fn()
    render(
      <SiteDetailsStub analyticsRefreshToken={0} preferredMetric="" onMetricsChanged={metricsChanged} />,
    )

    // Wait for initial load and list.
    await screen.findByTestId('line-chart')
    await screen.findByText('carbon_stock')

    // Open delete confirmation.
    await user.click(screen.getByLabelText('Delete carbon_stock record'))
    const dialog = await screen.findByRole('dialog', { name: 'Delete the carbon_stock record?' })
    expect(dialog).toBeInTheDocument()

    // Confirm deletion.
    deleteMetric.mockResolvedValue({})
    await user.click(within(dialog).getByRole('button', { name: 'Delete record' }))

    await waitFor(() => {
      expect(deleteMetric).toHaveBeenCalledWith(PROJECT_ID, SITE_ID, 'del-target')
    })

    // List refreshes and callback fires with empty string (per SiteDetails contract).
    await waitFor(() => {
      expect(metricsChanged).toHaveBeenCalledWith('')
    })
  })
})
