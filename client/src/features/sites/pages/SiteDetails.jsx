import { ArrowLeft, Map, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteSite, getSite } from '../../../api/siteApi'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { ErrorState, LoadingState } from '../../../components/common/AsyncState'
import Modal from '../../../components/common/Modal'
import { normalizeApiError } from '../../../services/api'
import SiteForm from '../components/SiteForm'
import MapView from '../components/MapView'
import SiteAnalyticsSection from '../../analytics/components/SiteAnalyticsSection'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export default function SiteDetails() {
  const { projectId, siteId } = useParams()
  const navigate = useNavigate()
  const [site, setSite] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true); setError('')
    try { const response = await getSite(projectId, siteId); setSite(response.data) } catch (requestError) { setError(normalizeApiError(requestError)) } finally { setIsLoading(false) }
  }, [projectId, siteId])

  useEffect(() => {
    const loadSite = async () => load()
    loadSite()
  }, [load])

  const remove = async () => {
    setIsDeleting(true)
    try { await deleteSite(projectId, siteId); navigate(`/projects/${projectId}`, { replace: true }) } catch (requestError) { setError(normalizeApiError(requestError)); setIsDeleting(false) }
  }

  if (isLoading) return <LoadingState label="Loading site..." />
  if (error && !site) return <ErrorState message={error} onRetry={load} />
  if (!site) return <ErrorState message="Site not found." onRetry={load} />

  return <div className="resource-page">
    <Link className="back-link" to={`/projects/${projectId}`}><ArrowLeft size={16} /> Back to project</Link>
    <section className="detail-hero"><div><span className="eyebrow">Geographic site</span><h1>{site.name}</h1><p>{site.description || 'No description added yet.'}</p></div><div className="detail-actions"><button className="secondary-button" type="button" onClick={() => setIsEditing(true)}><Pencil size={16} /> Edit</button><button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Delete</button></div></section>
    {error && <ErrorState message={error} onRetry={load} />}
    <div className="detail-meta"><div><span>Area</span><strong>{site.area_hectares ?? '—'} hectares</strong></div><div><span>Created</span><strong>{formatDate(site.created_at)}</strong></div><div><span>Updated</span><strong>{formatDate(site.updated_at)}</strong></div></div>
    <section className="site-insight-grid"><article className="placeholder-panel map-panel"><Map size={23} /><span className="eyebrow">Site boundary</span><h2>Read-only map</h2>{site.boundary ? <MapView boundary={site.boundary} /> : <p>No boundary has been saved for this site.</p>}</article></section>
    <SiteAnalyticsSection projectId={projectId} siteId={siteId} />
    {isEditing && <Modal title="Edit site" description="Area is recalculated by the backend when the boundary changes." onClose={() => setIsEditing(false)}><SiteForm projectId={projectId} site={site} onCancel={() => setIsEditing(false)} onSuccess={(value) => { setSite(value); setIsEditing(false) }} /></Modal>}
    {confirmDelete && <ConfirmDialog title={`Delete ${site.name}?`} description="This permanently removes the site and its associated metric records." isLoading={isDeleting} onClose={() => setConfirmDelete(false)} onConfirm={remove} />}
  </div>
}
