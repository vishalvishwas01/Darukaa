import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteMetric, listMetrics } from '../../../api/metricApi'
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/AsyncState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import Modal from '../../../components/common/Modal'
import { normalizeApiError } from '../../../services/api'
import MetricForm from './MetricForm'
import { formatMetricTimestamp, formatMetricValue, sortMetricsNewestFirst } from '../utils/metricFormat'

// The list endpoint returns records oldest first and caps a request at 1000 rows. We load a
// bounded newest-first window (the tail of that ordering) and paginate it in the browser, so a
// freshly created record stays visible near the top for realistic site sizes.
const WINDOW_LIMIT = 200
const PAGE_SIZE = 20

export default function SiteMetricRecords({ projectId, siteId, onMetricsChanged }) {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(0)
  const [formMode, setFormMode] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [recentId, setRecentId] = useState('')
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setError('')
    try {
      const first = await listMetrics(projectId, siteId, { limit: WINDOW_LIMIT, offset: 0 })
      let windowRecords = Array.isArray(first.data?.items) ? first.data.items : []
      const reportedTotal = Number(first.data?.total)
      const nextTotal = Number.isFinite(reportedTotal) ? reportedTotal : windowRecords.length
      if (nextTotal > WINDOW_LIMIT) {
        const tail = await listMetrics(projectId, siteId, { limit: WINDOW_LIMIT, offset: nextTotal - WINDOW_LIMIT })
        windowRecords = Array.isArray(tail.data?.items) ? tail.data.items : []
      }
      if (requestId !== requestIdRef.current) return null
      const sortedRecords = sortMetricsNewestFirst(windowRecords)
      setRecords(sortedRecords)
      setTotal(nextTotal)
      setPage(0)
      return sortedRecords
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return null
      setError(normalizeApiError(requestError))
      setRecords([])
      setTotal(0)
      return null
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false)
    }
  }, [projectId, siteId])

  useEffect(() => {
    const loadRecords = async () => load()
    loadRecords()
  }, [load])

  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRecords = useMemo(
    () => records.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [currentPage, records],
  )
  const rangeStart = records.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const rangeEnd = Math.min(records.length, (currentPage + 1) * PAGE_SIZE)
  const rangeLabel = total > records.length
    ? `Showing ${rangeStart}–${rangeEnd} of the ${records.length} most recent loaded records (site total ${total}).`
    : `Showing ${rangeStart}–${rangeEnd} of ${records.length} record${records.length === 1 ? '' : 's'}.`

  const handleSaved = async (savedMetric) => {
    const wasCreated = formMode === 'create'
    setFormMode(null)
    setActionError('')
    const loadedRecords = await load()
    setRecentId(savedMetric?.id || '')
    const label = savedMetric ? `${savedMetric.metric_name} (${savedMetric.unit})` : 'Metric record'
    const prefix = `${label} was ${wasCreated ? 'added' : 'updated'}.`
    if (loadedRecords && savedMetric?.id && !loadedRecords.some((record) => record.id === savedMetric.id)) {
      setNotice(`${prefix} It falls outside the ${WINDOW_LIMIT} most recent records listed here, but analytics include it.`)
    } else {
      setNotice(`${prefix} Analytics refreshed.`)
    }
    onMetricsChanged?.(savedMetric?.metric_name || '')
  }

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return
    const target = deleteTarget
    setIsDeleting(true)
    setActionError('')
    try {
      await deleteMetric(projectId, siteId, target.id)
      setDeleteTarget(null)
      setRecentId('')
      const loadedRecords = await load()
      setNotice(`${target.metric_name} (${target.unit}) was deleted.${loadedRecords ? ' Analytics refreshed.' : ''}`)
      onMetricsChanged?.('')
    } catch (requestError) {
      setDeleteTarget(null)
      setActionError(normalizeApiError(requestError))
    } finally {
      setIsDeleting(false)
    }
  }

  return <section className="metric-records-section" aria-labelledby="metric-records-heading">
    <div className="section-heading">
      <div>
        <span className="eyebrow">Field evidence</span>
        <h2 id="metric-records-heading">Metric records</h2>
        <p className="section-caption">Stored measurements for this site, listed newest first.</p>
      </div>
      <button className="primary-button" type="button" onClick={() => setFormMode('create')}><Plus size={17} /> Add metric record</button>
    </div>

    {notice && <div className="success-banner" role="status">{notice}</div>}
    {actionError && <div className="form-alert" role="alert">{actionError}</div>}

    {isLoading && <LoadingState label="Loading metric records..." />}
    {!isLoading && error && <ErrorState message={error} onRetry={load} />}
    {!isLoading && !error && records.length === 0 && <EmptyState
      title="No metric records for this site yet."
      description={total > 0 ? 'The backend reports records for this site, but none matched the loaded window. Reload to try again.' : 'Add a measured value to start building evidence for this site.'}
      action={<button className="primary-button" type="button" onClick={() => setFormMode('create')}><Plus size={17} /> Add first metric record</button>}
    />}
    {!isLoading && !error && records.length > 0 && <>
      <div className="metric-table-wrap" role="region" aria-label="Metric records table" tabIndex={0}>
        <table className="metric-table">
          <caption className="visually-hidden">Metric records stored for this site, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Metric name</th>
              <th scope="col">Value</th>
              <th scope="col">Unit</th>
              <th scope="col">Recorded at</th>
              <th scope="col">Created at</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => <tr key={record.id} className={record.id === recentId ? 'metric-row-new' : undefined}>
              <td className="metric-name-cell"><strong>{record.metric_name}</strong>{record.id === recentId && <span className="metric-row-badge">Just saved</span>}</td>
              <td className="metric-value-cell">{formatMetricValue(record.metric_value)}</td>
              <td>{record.unit}</td>
              <td>{formatMetricTimestamp(record.recorded_at)}</td>
              <td>{formatMetricTimestamp(record.created_at)}</td>
              <td>
                <div className="metric-row-actions">
                  <button className="icon-button" type="button" aria-label={`Edit ${record.metric_name} record`} onClick={() => setFormMode(record)} disabled={isDeleting}><Pencil size={16} /></button>
                  <button className="icon-button danger-icon" type="button" aria-label={`Delete ${record.metric_name} record`} onClick={() => setDeleteTarget(record)} disabled={isDeleting}><Trash2 size={16} /></button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="metric-table-hint">Scroll this table sideways to reach every column.</p>
      <div className="metric-pagination">
        <span className="section-count" role="status">{rangeLabel}</span>
        <div className="metric-pagination-actions">
          <button className="secondary-button compact" type="button" onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0 || isDeleting} aria-label="Previous metric records page"><ChevronLeft size={15} /> Previous</button>
          <span className="metric-page-count">Page {currentPage + 1} of {pageCount}</span>
          <button className="secondary-button compact" type="button" onClick={() => setPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1 || isDeleting} aria-label="Next metric records page">Next <ChevronRight size={15} /></button>
        </div>
      </div>
    </>}
    {formMode && <Modal
      title={formMode === 'create' ? 'Add metric record' : 'Edit metric record'}
      description={formMode === 'create' ? 'Saved against this site exactly as measured. Ownership and ids stay server-side.' : `Update the stored values for ${formMode.metric_name}.`}
      onClose={() => setFormMode(null)}
    >
      <MetricForm
        key={formMode === 'create' ? 'create' : formMode.id}
        projectId={projectId}
        siteId={siteId}
        metric={formMode === 'create' ? null : formMode}
        onCancel={() => setFormMode(null)}
        onSuccess={handleSaved}
      />
    </Modal>}
    {deleteTarget && <ConfirmDialog
      title={`Delete the ${deleteTarget.metric_name} record?`}
      description={`This permanently removes ${deleteTarget.metric_name} (${formatMetricValue(deleteTarget.metric_value)} ${deleteTarget.unit}) recorded on ${formatMetricTimestamp(deleteTarget.recorded_at)}. Site and project analytics update afterwards.`}
      confirmLabel="Delete record"
      isLoading={isDeleting}
      onClose={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    />}
  </section>
}