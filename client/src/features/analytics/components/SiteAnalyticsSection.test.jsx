import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSiteAnalyticsSummary, getSiteTimeSeries } from '../../../api/analyticsApi'
import {
  apiError,
  deferred,
  emptySiteSummary,
  siteSummary,
  timeSeries,
  PROJECT_ID,
  SITE_ID,
} from '../../../test/fixtures'
import SiteAnalyticsSection from './SiteAnalyticsSection'

// API module is mocked at its boundary: no axios instance, no HTTP, no token.
vi.mock('../../../api/analyticsApi', () => ({
  getSiteAnalyticsSummary: vi.fn(),
  getSiteTimeSeries: vi.fn(),
}))

// Chart.js / react-chartjs-2 are mocked so jsdom never touches a real canvas.
// The real TimeSeriesChart runs (so toTimeSeriesChartData filtering is exercised)
// but the <Line> render is replaced with a plain element we can assert on.
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: vi.fn(),
  Filler: vi.fn(),
  LinearScale: vi.fn(),
  LineElement: vi.fn(),
  Legend: vi.fn(),
  PointElement: vi.fn(),
  Tooltip: vi.fn(),
}))

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }) => (
    <div
      data-testid="line-chart"
      data-label={data?.datasets?.[0]?.label || ''}
      data-point-count={data?.datasets?.[0]?.data?.length || 0}
    />
  ),
}))

const renderSection = (props = {}) =>
  render(<SiteAnalyticsSection projectId={PROJECT_ID} siteId={SITE_ID} {...props} />)

const loadedSummary = siteSummary()
const loadedSeries = timeSeries()

describe('SiteAnalyticsSection loading, empty and summary states', () => {
  beforeEach(() => {
    getSiteAnalyticsSummary.mockReset()
    getSiteTimeSeries.mockReset()
  })

  it('shows a loading state while the site summary is being fetched', () => {
    getSiteAnalyticsSummary.mockReturnValue(deferred().promise)
    renderSection()
    expect(screen.getByRole('status')).toHaveTextContent('Loading site summary...')
  })

  it('shows a clear empty state when there are no metric records', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: emptySiteSummary() })
    renderSection()
    expect(await screen.findByText('No metric records are available for this site yet.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Metric')).not.toBeInTheDocument()
  })

  it('renders summary cards, a metric selector and date controls once loaded', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')

    expect(screen.getByText('Metric records').closest('.analytics-summary-card')).toHaveTextContent('3')
    expect(screen.getByText('Metric types').closest('.analytics-summary-card')).toHaveTextContent('2')
    expect(screen.getByLabelText('Metric')).toBeInTheDocument()
    expect(screen.getByLabelText('Start date')).toBeInTheDocument()
    expect(screen.getByLabelText('End date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled()
  })

  it('populates the metric selector from the backend', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    const selector = await screen.findByLabelText('Metric')
    expect(selector.options).toHaveLength(2)
    expect(selector.options[0]).toHaveValue('carbon_stock')
    expect(selector.options[1]).toHaveValue('soil_ph')
    expect(selector).toHaveValue('carbon_stock')
  })

  it('renders a metric summary table with per-metric stats', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')
    expect(screen.getByText('Metric summary')).toBeInTheDocument()
    expect(screen.getByText('carbon_stock')).toBeInTheDocument()
    expect(screen.getByText('soil_ph')).toBeInTheDocument()
  })

  it('displays a summary API error with a retry action', async () => {
    getSiteAnalyticsSummary.mockRejectedValue(apiError(503))
    renderSection()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The server is currently unavailable. Please try again.')
    expect(within(alert).getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })

  it('retries the summary when retry is clicked', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary
      .mockRejectedValueOnce(apiError(503, 'Summary unavailable.'))
      .mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })

    renderSection()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Summary unavailable.')
    await user.click(within(alert).getByRole('button', { name: /Retry/ }))

    await screen.findByTestId('line-chart')
    expect(getSiteAnalyticsSummary).toHaveBeenCalledTimes(2)
  })
})

describe('SiteAnalyticsSection time-series', () => {
  beforeEach(() => {
    getSiteAnalyticsSummary.mockReset()
    getSiteTimeSeries.mockReset()
  })

  it('passes the time-series data to the chart component', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    const chart = await screen.findByTestId('line-chart')
    expect(chart).toHaveAttribute('data-label', 'carbon_stock (tonnes)')
    expect(chart).toHaveAttribute('data-point-count', '2')
  })

  it('does not crash when the time-series contains unusable timestamps', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({
      data: timeSeries({
        points: [
          { recorded_at: '2026-01-01T00:00:00Z', value: '10.0000' },
          { recorded_at: 'not-a-timestamp', value: '5.0000' },
          { recorded_at: '2026-02-01T00:00:00Z', value: 'not-a-number' },
          { recorded_at: '2026-03-04T05:06:00Z', value: '128.4500' },
        ],
      }),
    })
    renderSection()

    const chart = await screen.findByTestId('line-chart')
    expect(chart).toHaveAttribute('data-point-count', '2')
  })

  it('shows an empty state when no points match the filter', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: timeSeries({ points: [] }) })
    renderSection()

    expect(await screen.findByText('No points match this metric and date range.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })

  it('displays the time-series error with a retry action', async () => {
    const seriesDeferred = deferred()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockReturnValueOnce(seriesDeferred.promise)

    renderSection()
    expect(await screen.findByText('Loading time-series...')).toBeInTheDocument()

    await act(async () => {
      seriesDeferred.reject(apiError(503, 'Series unavailable.'))
    })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Series unavailable.')
    expect(within(alert).getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })

  it('retries the time-series when retry is clicked', async () => {
    const user = userEvent.setup()
    const seriesDeferred = deferred()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockReturnValueOnce(seriesDeferred.promise)
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })

    renderSection()
    expect(await screen.findByText('Loading time-series...')).toBeInTheDocument()

    await act(async () => {
      seriesDeferred.reject(apiError(503, 'Series unavailable.'))
    })
    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: /Retry/ }))

    await screen.findByTestId('line-chart')
    expect(getSiteTimeSeries).toHaveBeenCalledTimes(2)
  })
})

describe('SiteAnalyticsSection interactions', () => {
  beforeEach(() => {
    getSiteAnalyticsSummary.mockReset()
    getSiteTimeSeries.mockReset()
  })

  it('requests time-series data for the selected metric', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')
    expect(getSiteTimeSeries).toHaveBeenLastCalledWith(
      PROJECT_ID,
      SITE_ID,
      expect.objectContaining({ metric_name: 'carbon_stock' }),
    )

    await user.selectOptions(screen.getByLabelText('Metric'), 'soil_ph')

    await waitFor(() => {
      expect(getSiteTimeSeries).toHaveBeenLastCalledWith(
        PROJECT_ID,
        SITE_ID,
        expect.objectContaining({ metric_name: 'soil_ph' }),
      )
    })
  })

  it('requests time-series data with the selected date-range boundaries', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')

    await user.type(screen.getByLabelText('Start date'), '2026-03-01')
    await user.type(screen.getByLabelText('End date'), '2026-03-04')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const args = getSiteTimeSeries.mock.calls.at(-1)
      expect(args[2]).toEqual(
        expect.objectContaining({
          metric_name: 'carbon_stock',
          start_date: '2026-03-01T00:00:00Z',
          end_date: '2026-03-04T23:59:59.999Z',
        }),
      )
    })
  })

  it('shows a validation message for an inverted date range without requesting data', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')
    const callsBefore = getSiteTimeSeries.mock.calls.length

    await user.type(screen.getByLabelText('Start date'), '2026-03-04')
    await user.type(screen.getByLabelText('End date'), '2026-03-01')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(await screen.findByText('Start date must be before or equal to the end date.')).toBeInTheDocument()
    expect(getSiteTimeSeries).toHaveBeenCalledTimes(callsBefore)
  })

  it('clears the date range and refetches without date boundaries', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection()

    await screen.findByTestId('line-chart')

    await user.type(screen.getByLabelText('Start date'), '2026-03-01')
    await user.type(screen.getByLabelText('End date'), '2026-03-04')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      expect(getSiteTimeSeries.mock.calls.at(-1)[2]).toHaveProperty('start_date')
    })

    await user.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      const params = getSiteTimeSeries.mock.calls.at(-1)[2]
      expect(params).not.toHaveProperty('start_date')
      expect(params).not.toHaveProperty('end_date')
    })
  })
})

describe('SiteAnalyticsSection refresh behaviour', () => {
  beforeEach(() => {
    getSiteAnalyticsSummary.mockReset()
    getSiteTimeSeries.mockReset()
  })

  it('refetches the summary when the refresh token changes', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })

    const { rerender } = renderSection()
    await screen.findByTestId('line-chart')
    expect(getSiteAnalyticsSummary).toHaveBeenCalledTimes(1)

    rerender(<SiteAnalyticsSection projectId={PROJECT_ID} siteId={SITE_ID} refreshToken={1} />)

    await waitFor(() => {
      expect(getSiteAnalyticsSummary).toHaveBeenCalledTimes(2)
    })
  })

  it('honours a preferred metric that is available on the backend', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: timeSeries({ metric_name: 'soil_ph' }) })
    renderSection({ preferredMetric: 'soil_ph' })

    const selector = await screen.findByLabelText('Metric')
    expect(selector).toHaveValue('soil_ph')
    expect(getSiteTimeSeries).toHaveBeenLastCalledWith(
      PROJECT_ID,
      SITE_ID,
      expect.objectContaining({ metric_name: 'soil_ph' }),
    )
  })

  it('falls back to the first available metric when the preferred one is unknown', async () => {
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })
    renderSection({ preferredMetric: 'nonexistent_metric' })

    const selector = await screen.findByLabelText('Metric')
    expect(selector).toHaveValue('carbon_stock')
  })

  it('preserves the selected metric and date range across a refresh', async () => {
    const user = userEvent.setup()
    getSiteAnalyticsSummary.mockResolvedValue({ data: loadedSummary })
    getSiteTimeSeries.mockResolvedValue({ data: loadedSeries })

    const { rerender } = renderSection()
    await screen.findByTestId('line-chart')

    await user.selectOptions(screen.getByLabelText('Metric'), 'soil_ph')
    await user.type(screen.getByLabelText('Start date'), '2026-03-01')
    await user.type(screen.getByLabelText('End date'), '2026-03-04')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => {
      const params = getSiteTimeSeries.mock.calls.at(-1)[2]
      expect(params).toEqual(
        expect.objectContaining({
          metric_name: 'soil_ph',
          start_date: '2026-03-01T00:00:00Z',
          end_date: '2026-03-04T23:59:59.999Z',
        }),
      )
    })

    rerender(<SiteAnalyticsSection projectId={PROJECT_ID} siteId={SITE_ID} refreshToken={1} />)

    await waitFor(() => {
      expect(getSiteAnalyticsSummary).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByLabelText('Metric')).toHaveValue('soil_ph')
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-03-01')
    expect(screen.getByLabelText('End date')).toHaveValue('2026-03-04')
    expect(getSiteTimeSeries.mock.calls.at(-1)[2]).toEqual(
      expect.objectContaining({
        metric_name: 'soil_ph',
        start_date: '2026-03-01T00:00:00Z',
        end_date: '2026-03-04T23:59:59.999Z',
      }),
    )
  })

  it('discards a stale summary response when a refresh is already in flight', async () => {
    const stale = deferred()
    const fresh = deferred()
    getSiteAnalyticsSummary.mockReturnValueOnce(stale.promise)
    getSiteAnalyticsSummary.mockReturnValue(fresh.promise)
    getSiteTimeSeries.mockReturnValue(deferred().promise)

    const { rerender } = renderSection()
    rerender(<SiteAnalyticsSection projectId={PROJECT_ID} siteId={SITE_ID} refreshToken={1} />)

    // Resolve the stale response first — it must be discarded.
    await act(async () => {
      stale.resolve({ data: siteSummary({ total_metric_records: 1 }) })
    })

    await waitFor(() => {
      expect(screen.getByText('Loading site summary...')).toBeInTheDocument()
    })

    // Resolve the fresh response — it must be accepted.
    await act(async () => {
      fresh.resolve({ data: siteSummary({ total_metric_records: 5 }) })
    })

    await waitFor(() => {
      expect(screen.getByText('Metric records').closest('.analytics-summary-card')).toHaveTextContent('5')
    })
  })
})

