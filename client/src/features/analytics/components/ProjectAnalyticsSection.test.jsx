import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProjectAnalyticsSummary } from '../../../api/analyticsApi'
import {
  apiError,
  projectSummary,
  emptyProjectSummary,
  PROJECT_ID,
} from '../../../test/fixtures'
import ProjectAnalyticsSection from './ProjectAnalyticsSection'

vi.mock('../../../api/analyticsApi', () => ({
  getProjectAnalyticsSummary: vi.fn(),
}))

const renderSection = () => render(<ProjectAnalyticsSection projectId={PROJECT_ID} />)

describe('ProjectAnalyticsSection', () => {
  beforeEach(() => {
    getProjectAnalyticsSummary.mockReset()
  })

  it('shows a loading state on first load', () => {
    getProjectAnalyticsSummary.mockReturnValue(Promise.resolve({ data: projectSummary() }))
    renderSection()
    expect(screen.getByText('Loading project summary...')).toBeInTheDocument()
  })

  it('renders project summary cards, metric rows and per-site counts', async () => {
    getProjectAnalyticsSummary.mockResolvedValue({ data: projectSummary() })
    renderSection()

    await screen.findByText('carbon_stock')
    expect(screen.getByText('Evidence across the project')).toBeInTheDocument()
    expect(screen.getByText('Metric records').closest('.analytics-summary-card')).toHaveTextContent('3')
    expect(screen.getByText('Sites').closest('.analytics-summary-card')).toHaveTextContent('2')
    expect(screen.getByText('Metric types').closest('.analytics-summary-card')).toHaveTextContent('2')
    expect(screen.getByText('carbon_stock')).toBeInTheDocument()
    expect(screen.getByText('tonnes')).toBeInTheDocument()
    expect(screen.getByText('2 records')).toBeInTheDocument()
    expect(screen.getByText('soil_ph')).toBeInTheDocument()
    expect(screen.getByText('pH')).toBeInTheDocument()
    expect(screen.getByText('1 records')).toBeInTheDocument()
    expect(screen.getByText('Records by site')).toBeInTheDocument()
    expect(screen.getByText('2 sites')).toBeInTheDocument()
  })

  it('shows a clear empty state when the project has no metric records', async () => {
    getProjectAnalyticsSummary.mockResolvedValue({ data: emptyProjectSummary() })
    renderSection()
    expect(await screen.findByText('No metric records are available across this project yet.')).toBeInTheDocument()
    expect(screen.queryByText('Metric records')).not.toBeInTheDocument()
  })

  it('displays a project summary API error with retry', async () => {
    getProjectAnalyticsSummary.mockRejectedValue(apiError(503, 'Project summary unavailable.'))
    renderSection()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Project summary unavailable.')
    expect(within(alert).getByRole('button', { name: /Retry/ })).toBeInTheDocument()
  })

  it('retries the project summary when retry is clicked', async () => {
    const user = userEvent.setup()
    getProjectAnalyticsSummary
      .mockRejectedValueOnce(apiError(503, 'Project summary unavailable.'))
      .mockResolvedValue({ data: projectSummary() })
    renderSection()

    const alert = await screen.findByRole('alert')
    await user.click(within(alert).getByRole('button', { name: /Retry/ }))

    await screen.findByText('Evidence across the project')
    expect(getProjectAnalyticsSummary).toHaveBeenCalledTimes(2)
  })
})
