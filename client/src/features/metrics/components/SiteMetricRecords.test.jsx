import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteMetric, listMetrics } from '../../../api/metricApi'
import { apiError, deferred, metricPage, metricRecord, PROJECT_ID, SITE_ID } from '../../../test/fixtures'
import { formatMetricTimestamp } from '../utils/metricFormat'
import SiteMetricRecords from './SiteMetricRecords'

// The API module is mocked at its boundary: no axios instance, no HTTP, no token.
vi.mock('../../../api/metricApi', () => ({
  listMetrics: vi.fn(),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  deleteMetric: vi.fn(),
}))

const carbonStock = metricRecord({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  metric_name: 'carbon_stock',
  metric_value: '128.4500',
  unit: 'tonnes',
  recorded_at: '2026-03-04T05:06:00Z',
  created_at: '2026-03-04T05:07:00Z',
})

const soilPh = metricRecord({
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  metric_name: 'soil_ph',
  metric_value: '6.4000',
  unit: 'pH',
  recorded_at: '2026-02-01T09:30:00Z',
  created_at: '2026-02-01T09:31:00Z',
})

const olderStock = metricRecord({
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  metric_name: 'carbon_stock',
  metric_value: '10.0000',
  unit: 'tonnes',
  recorded_at: '2026-01-15T00:00:00Z',
  created_at: '2026-01-15T00:00:30Z',
})

const paginatedRecords = (count) => Array.from({ length: count }, (_, index) => metricRecord({
  id: `record-${String(index).padStart(3, '0')}`,
  metric_name: 'carbon_stock',
  metric_value: String((index + 1) * 1.5),
  unit: 'tonnes',
  // Valid, strictly increasing UTC instants for any record count.
  recorded_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
  created_at: new Date(Date.UTC(2026, 0, 1 + index)).toISOString(),
}))

const renderRecords = (props = {}) => {
  const onMetricsChanged = vi.fn()
  render(<SiteMetricRecords projectId={PROJECT_ID} siteId={SITE_ID} onMetricsChanged={onMetricsChanged} {...props} />)
  return { onMetricsChanged }
}

const bodyRows = () => screen.getAllByRole('row').slice(1)
const bodyRowTexts = () => bodyRows().map((row) => row.textContent)

/** Resolves the initial list request with `items`, then any later request with `afterReload`. */
const listOnce = (items, total = items.length, afterReload = items) => {
  listMetrics.mockResolvedValueOnce({ data: metricPage(items, { total }) })
  listMetrics.mockResolvedValue({ data: metricPage(afterReload, { total: afterReload.length }) })
}

describe('SiteMetricRecords loading, empty and error states', () => {
  beforeEach(() => {
    listMetrics.mockReset()
    deleteMetric.mockReset()
  })

  it('shows a loading state while the records are being fetched', () => {
    listMetrics.mockReturnValue(deferred().promise)
    renderRecords()

    expect(screen.getByRole('status')).toHaveTextContent('Loading metric records...')
  })

  it('shows an empty state that explains how to add the first record', async () => {
    listMetrics.mockResolvedValue({ data: metricPage([], { total: 0 }) })
    renderRecords()

    expect(await screen.findByText('No metric records for this site yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add first metric record' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows an error state with a retry action when the list request fails', async () => {
    listMetrics.mockRejectedValue(apiError(500))
    renderRecords()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The server is currently unavailable. Please try again.')
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })

  it('surfaces an authorization message returned by the backend', async () => {
    listMetrics.mockRejectedValue(apiError(403, 'Not enough permissions.'))
    renderRecords()

    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough permissions.')
  })

  it('retries the list request and renders the records', async () => {
    const user = userEvent.setup()
    listMetrics.mockRejectedValueOnce(apiError(500, 'Unable to list metrics.'))
    listMetrics.mockResolvedValue({ data: metricPage([carbonStock]) })
    renderRecords()

    await user.click(await screen.findByRole('button', { name: /Retry/ }))

    expect(await screen.findByText('carbon_stock')).toBeInTheDocument()
    expect(listMetrics).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

// --- records table ---

describe('SiteMetricRecords table', () => {
  beforeEach(() => {
    listMetrics.mockReset()
    deleteMetric.mockReset()
  })

  it('renders the stored metric name, value, unit and timestamps', async () => {
    listOnce([olderStock, soilPh, carbonStock])
    renderRecords()

    await screen.findByRole('table')
    expect(screen.getAllByText('carbon_stock')).toHaveLength(2)
    expect(screen.getByText('soil_ph')).toBeInTheDocument()
    expect(screen.getByText('128.45')).toBeInTheDocument()
    expect(screen.getByText('6.4')).toBeInTheDocument()
    expect(screen.getAllByText('tonnes')).toHaveLength(2)
    expect(screen.getByText('pH')).toBeInTheDocument()
    expect(screen.getByText(formatMetricTimestamp(carbonStock.recorded_at))).toBeInTheDocument()
    expect(screen.getByText(formatMetricTimestamp(carbonStock.created_at))).toBeInTheDocument()
    for (const header of ['Metric name', 'Value', 'Unit', 'Recorded at', 'Created at', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument()
    }
  })

  it('lists records newest first even when the API returns them oldest first', async () => {
    listOnce([olderStock, soilPh, carbonStock])
    renderRecords()

    await screen.findByRole('table')
    const texts = bodyRowTexts()
    expect(texts).toHaveLength(3)
    expect(texts[0]).toContain('carbon_stock')
    expect(texts[0]).toContain('128.45')
    expect(texts[1]).toContain('soil_ph')
    expect(texts[2]).toContain('10')
  })

  it('requests a bounded window and the newest slice when the site has more records', async () => {
    const windowRecords = paginatedRecords(200)
    const newestSlice = paginatedRecords(250).slice(50)
    listMetrics.mockResolvedValueOnce({ data: metricPage(windowRecords, { total: 250 }) })
    listMetrics.mockResolvedValueOnce({ data: metricPage(newestSlice, { total: 250, offset: 50 }) })
    renderRecords()

    await screen.findByText('Showing 1–20 of the 200 most recent loaded records (site total 250).')
    expect(listMetrics).toHaveBeenNthCalledWith(1, PROJECT_ID, SITE_ID, { limit: 200, offset: 0 })
    expect(listMetrics).toHaveBeenNthCalledWith(2, PROJECT_ID, SITE_ID, { limit: 200, offset: 50 })
    expect(bodyRowTexts()[0]).toContain('375')
  })

  it('paginates the loaded records and reports the visible range', async () => {
    const user = userEvent.setup()
    listOnce(paginatedRecords(25))
    renderRecords()

    expect(await screen.findByText('Showing 1–20 of 25 records.')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(20)
    expect(screen.getByRole('button', { name: 'Previous metric records page' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next metric records page' }))

    expect(screen.getByText('Showing 21–25 of 25 records.')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Next metric records page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous metric records page' })).toBeEnabled()
  })

  it('keeps the table inside a keyboard reachable scroll container for narrow screens', async () => {
    listOnce([carbonStock])
    renderRecords()

    const region = await screen.findByRole('region', { name: 'Metric records table' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Scroll this table sideways to reach every column.')).toBeInTheDocument()
  })
})

// --- actions ---

describe('SiteMetricRecords actions', () => {
  beforeEach(() => {
    listMetrics.mockReset()
    deleteMetric.mockReset()
  })

  it('opens the metric form from the add action', async () => {
    const user = userEvent.setup()
    listOnce([carbonStock])
    renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: /Add metric record/ }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Add metric record' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^metric name/i)).toHaveValue('')
  })

  it('opens the metric form pre-filled from the row edit action', async () => {
    const user = userEvent.setup()
    listOnce([soilPh])
    renderRecords()
    await screen.findByText('soil_ph')

    await user.click(screen.getByRole('button', { name: 'Edit soil_ph record' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Edit metric record' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^metric name/i)).toHaveValue('soil_ph')
    expect(within(dialog).getByLabelText(/^unit/i)).toHaveValue('pH')
  })

  it('asks for confirmation before deleting and identifies the record', async () => {
    const user = userEvent.setup()
    listOnce([carbonStock, soilPh])
    renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: 'Delete carbon_stock record' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete the carbon_stock record?' })).toBeInTheDocument()
    expect(within(dialog).getByText(/128\.45 tonnes/)).toBeInTheDocument()
    expect(dialog).toHaveTextContent(formatMetricTimestamp(carbonStock.recorded_at))
    expect(deleteMetric).not.toHaveBeenCalled()
  })

  it('does not delete anything when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    listOnce([carbonStock, soilPh])
    renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: 'Delete carbon_stock record' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deleteMetric).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('carbon_stock')).toBeInTheDocument()
  })

  it('deletes the confirmed record, refreshes the list and asks analytics to refresh', async () => {
    const user = userEvent.setup()
    listMetrics.mockResolvedValueOnce({ data: metricPage([carbonStock, soilPh]) })
    listMetrics.mockResolvedValue({ data: metricPage([soilPh]) })
    deleteMetric.mockResolvedValue({ status: 204 })
    const { onMetricsChanged } = renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: 'Delete carbon_stock record' }))
    await user.click(screen.getByRole('button', { name: 'Delete record' }))

    await waitFor(() => expect(deleteMetric).toHaveBeenCalledWith(PROJECT_ID, SITE_ID, carbonStock.id))
    expect(await screen.findByText('carbon_stock (tonnes) was deleted. Analytics refreshed.')).toBeInTheDocument()
    expect(screen.queryByText('carbon_stock')).not.toBeInTheDocument()
    expect(screen.getByText('soil_ph')).toBeInTheDocument()
    expect(listMetrics).toHaveBeenCalledTimes(2)
    expect(onMetricsChanged).toHaveBeenCalledWith('')
  })

  it('reports a deletion failure without removing the record', async () => {
    const user = userEvent.setup()
    listOnce([carbonStock, soilPh])
    deleteMetric.mockRejectedValue(apiError(404, 'Metric not found.'))
    const { onMetricsChanged } = renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: 'Delete carbon_stock record' }))
    await user.click(screen.getByRole('button', { name: 'Delete record' }))

    expect(await screen.findByText('Metric not found.')).toBeInTheDocument()
    expect(screen.getByText('carbon_stock')).toBeInTheDocument()
    expect(bodyRowTexts()).toHaveLength(2)
    expect(onMetricsChanged).not.toHaveBeenCalled()
  })

  it('keeps the delete action disabled while it is running', async () => {
    const user = userEvent.setup()
    const pending = deferred()
    listOnce([carbonStock])
    deleteMetric.mockReturnValue(pending.promise)
    renderRecords()
    await screen.findByText('carbon_stock')

    await user.click(screen.getByRole('button', { name: 'Delete carbon_stock record' }))
    await user.click(screen.getByRole('button', { name: 'Delete record' }))

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(deleteMetric).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ status: 204 })
    })
  })
})