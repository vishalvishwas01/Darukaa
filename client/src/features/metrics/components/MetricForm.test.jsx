import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMetric, updateMetric } from '../../../api/metricApi'
import { apiError, deferred, metricRecord, PROJECT_ID, SITE_ID } from '../../../test/fixtures'
import { toDateTimeLocalValue, toRecordedAtIso } from '../utils/metricFormat'
import MetricForm from './MetricForm'

// The API module is mocked at its boundary: no axios instance, no HTTP, no token.
vi.mock('../../../api/metricApi', () => ({
  listMetrics: vi.fn(),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  deleteMetric: vi.fn(),
}))

const createdRecord = metricRecord()
const updatedRecord = metricRecord({ metric_value: '130.0000' })

const renderForm = (props = {}) => {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()
  render(<MetricForm projectId={PROJECT_ID} siteId={SITE_ID} onSuccess={onSuccess} onCancel={onCancel} {...props} />)
  return { onSuccess, onCancel }
}

const fields = () => ({
  name: screen.getByLabelText(/^metric name/i),
  value: screen.getByLabelText(/^metric value/i),
  unit: screen.getByLabelText(/^unit/i),
  recordedAt: screen.getByLabelText(/^recorded timestamp/i),
})

const fillValidForm = async (user, { metricName = 'carbon_stock', metricValue = '128.45', unit = 'tonnes', recordedAt = '2026-03-04T05:06' } = {}) => {
  await user.type(fields().name, metricName)
  await user.type(fields().value, metricValue)
  await user.type(fields().unit, unit)
  fireEvent.change(fields().recordedAt, { target: { value: recordedAt } })
}

describe('MetricForm rendering', () => {
  beforeEach(() => {
    createMetric.mockReset()
    updateMetric.mockReset()
  })

  it('renders every field the backend requires, all empty', () => {
    renderForm()
    const { name, value, unit, recordedAt } = fields()
    expect(name).toHaveValue('')
    expect(value).toHaveValue(null)
    expect(unit).toHaveValue('')
    expect(recordedAt).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add metric record' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  })

  it('uses input types that constrain entry at the browser level', () => {
    renderForm()
    expect(fields().name).toHaveAttribute('type', 'text')
    expect(fields().value).toHaveAttribute('type', 'number')
    expect(fields().value).toHaveAttribute('step', 'any')
    expect(fields().recordedAt).toHaveAttribute('type', 'datetime-local')
  })
})

describe('MetricForm validation', () => {
  beforeEach(() => {
    createMetric.mockReset()
    updateMetric.mockReset()
  })

  it('shows field-level errors when an empty form is submitted', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(screen.getByText('Metric name is required.')).toBeInTheDocument()
    expect(screen.getByText('Metric value is required.')).toBeInTheDocument()
    expect(screen.getByText('Unit is required.')).toBeInTheDocument()
    expect(screen.getByText('Recorded timestamp is required.')).toBeInTheDocument()
    expect(screen.getByText('Please correct the highlighted fields.')).toBeInTheDocument()
    expect(fields().name).toHaveAttribute('aria-invalid', 'true')
    expect(createMetric).not.toHaveBeenCalled()
  })

  it('rejects a whitespace-only metric name', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user, { metricName: '   ' })
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(screen.getByText('Metric name is required.')).toBeInTheDocument()
    expect(createMetric).not.toHaveBeenCalled()
  })

  it('rejects a metric value outside the column range', async () => {
    const user = userEvent.setup()
    renderForm()

    await fillValidForm(user, { metricValue: '1e12' })
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(screen.getByText(/Metric value must be between/)).toBeInTheDocument()
    expect(createMetric).not.toHaveBeenCalled()
  })

  it('requires a recorded timestamp before submitting', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(fields().name, 'carbon_stock')
    await user.type(fields().value, '128.45')
    await user.type(fields().unit, 'tonnes')
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(screen.getByText('Recorded timestamp is required.')).toBeInTheDocument()
    expect(createMetric).not.toHaveBeenCalled()
  })

  it('clears a field error once the user corrects the field', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Add metric record' }))
    expect(screen.getByText('Metric name is required.')).toBeInTheDocument()

    await user.type(fields().name, 'carbon_stock')
    expect(screen.queryByText('Metric name is required.')).not.toBeInTheDocument()
  })
})

describe('MetricForm submission', () => {
  beforeEach(() => {
    createMetric.mockReset()
    updateMetric.mockReset()
  })

  it('creates a record and sends only the fields the backend accepts', async () => {
    const user = userEvent.setup()
    createMetric.mockResolvedValue({ data: createdRecord })
    const { onSuccess } = renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    await waitFor(() => expect(createMetric).toHaveBeenCalledTimes(1))
    const [projectId, siteId, payload] = createMetric.mock.calls[0]
    expect(projectId).toBe(PROJECT_ID)
    expect(siteId).toBe(SITE_ID)
    expect(Object.keys(payload).sort()).toEqual(['metric_name', 'metric_value', 'recorded_at', 'unit'])
    expect(payload).toEqual({
      metric_name: 'carbon_stock',
      metric_value: 128.45,
      unit: 'tonnes',
      recorded_at: toRecordedAtIso('2026-03-04T05:06'),
    })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(createdRecord))
    expect(updateMetric).not.toHaveBeenCalled()
  })

  it('trims the metric name and unit before sending them', async () => {
    const user = userEvent.setup()
    createMetric.mockResolvedValue({ data: createdRecord })
    renderForm()

    await fillValidForm(user, { metricName: '  carbon_stock  ', unit: '  tonnes  ' })
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    await waitFor(() => expect(createMetric).toHaveBeenCalledTimes(1))
    expect(createMetric.mock.calls[0][2]).toMatchObject({ metric_name: 'carbon_stock', unit: 'tonnes' })
  })

  it('disables the submit button while the request is in flight and reports success once only', async () => {
    const user = userEvent.setup()
    const pending = deferred()
    createMetric.mockReturnValue(pending.promise)
    const { onSuccess } = renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    await waitFor(() => expect(createMetric).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /Saving\.\.\./ })).toBeDisabled()
    expect(onSuccess).not.toHaveBeenCalled()

    await act(async () => {
      pending.resolve({ data: createdRecord })
    })

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('ignores repeat submits while a save is already running', async () => {
    const user = userEvent.setup()
    const pending = deferred()
    createMetric.mockReturnValue(pending.promise)
    renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))
    await waitFor(() => expect(createMetric).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: /Saving\.\.\./ }))
    expect(createMetric).toHaveBeenCalledTimes(1)

    await act(async () => {
      pending.resolve({ data: createdRecord })
    })
  })
})

describe('MetricForm API errors', () => {
  beforeEach(() => {
    createMetric.mockReset()
    updateMetric.mockReset()
  })

  it('shows backend field errors next to the fields they belong to', async () => {
    const user = userEvent.setup()
    createMetric.mockRejectedValue(apiError(422, [
      { loc: ['body', 'metric_name'], msg: 'Value error, metric_name must not be empty' },
      { loc: ['body', 'unit'], msg: 'Field required' },
    ]))
    const { onSuccess } = renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(await screen.findByText('metric_name must not be empty')).toBeInTheDocument()
    expect(screen.getByText('Field required')).toBeInTheDocument()
    expect(screen.getByText('Please correct the highlighted fields.')).toBeInTheDocument()
    expect(fields().name).toHaveAttribute('aria-invalid', 'true')
    expect(fields().unit).toHaveAttribute('aria-invalid', 'true')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('shows a readable message for non-field API errors', async () => {
    const user = userEvent.setup()
    createMetric.mockRejectedValue(apiError(404, 'Site not found.'))
    const { onSuccess } = renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(await screen.findByText('Site not found.')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add metric record' })).toBeEnabled()
  })

  it('shows a readable message when the server cannot be reached', async () => {
    const user = userEvent.setup()
    createMetric.mockRejectedValue(new Error('Network Error'))
    renderForm()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Add metric record' }))

    expect(await screen.findByText('The server is currently unavailable. Please try again.')).toBeInTheDocument()
  })
})

describe('MetricForm edit mode', () => {
  beforeEach(() => {
    createMetric.mockReset()
    updateMetric.mockReset()
  })

  it('pre-fills the stored record values', () => {
    renderForm({ metric: createdRecord })

    const { name, value, unit, recordedAt } = fields()
    expect(name).toHaveValue('carbon_stock')
    expect(value).toHaveValue(128.45)
    expect(unit).toHaveValue('tonnes')
    expect(recordedAt).toHaveValue(toDateTimeLocalValue(createdRecord.recorded_at))
    expect(screen.getByRole('button', { name: 'Save metric record' })).toBeInTheDocument()
  })

  it('updates the existing record instead of creating a new one', async () => {
    const user = userEvent.setup()
    updateMetric.mockResolvedValue({ data: updatedRecord })
    const { onSuccess } = renderForm({ metric: createdRecord })

    await user.clear(fields().value)
    await user.type(fields().value, '130')
    await user.click(screen.getByRole('button', { name: 'Save metric record' }))

    await waitFor(() => expect(updateMetric).toHaveBeenCalledTimes(1))
    expect(updateMetric).toHaveBeenCalledWith(PROJECT_ID, SITE_ID, createdRecord.id, {
      metric_name: 'carbon_stock',
      metric_value: 130,
      unit: 'tonnes',
      // The stored instant is unchanged by the datetime-local round trip (timezone-independent).
      recorded_at: toRecordedAtIso(toDateTimeLocalValue(createdRecord.recorded_at)),
    })
    expect(createMetric).not.toHaveBeenCalled()
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updatedRecord))
  })

  it('cancels without calling the API', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderForm({ metric: createdRecord })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(updateMetric).not.toHaveBeenCalled()
    expect(createMetric).not.toHaveBeenCalled()
  })
})