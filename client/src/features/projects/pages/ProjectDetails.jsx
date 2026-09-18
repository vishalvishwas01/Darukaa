import { ArrowLeft, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteProject, getProject } from '../../../api/projectApi'
import { deleteSite, listSites } from '../../../api/siteApi'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/AsyncState'
import Modal from '../../../components/common/Modal'
import { normalizeApiError } from '../../../services/api'
import ProjectForm from '../components/ProjectForm'
import SiteForm from '../../sites/components/SiteForm'
import ProjectAnalyticsSection from '../../analytics/components/ProjectAnalyticsSection'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export default function ProjectDetails() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [formMode, setFormMode] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true); setError('')
    try {
      const [projectResponse, sitesResponse] = await Promise.all([getProject(projectId), listSites(projectId)])
      setProject(projectResponse.data); setSites(sitesResponse.data)
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally { setIsLoading(false) }
  }, [projectId])

  useEffect(() => {
    const loadProject = async () => load()
    loadProject()
  }, [load])

  const removeSite = async () => {
    setIsDeleting(true)
    try { await deleteSite(projectId, deleteTarget.id); setSites((current) => current.filter((site) => site.id !== deleteTarget.id)); setDeleteTarget(null); setNotice('Site deleted.') } catch (requestError) { setError(normalizeApiError(requestError)) } finally { setIsDeleting(false) }
  }

  const removeProject = async () => {
    setIsDeleting(true)
    try { await deleteProject(projectId); navigate('/projects', { replace: true }) } catch (requestError) { setError(normalizeApiError(requestError)); setIsDeleting(false) }
  }

  if (isLoading) return <LoadingState label="Loading project..." />
  if (error && !project) return <ErrorState message={error} onRetry={load} />
  if (!project) return <ErrorState message="Project not found." onRetry={load} />

  return <div className="resource-page">
    <Link className="back-link" to="/projects"><ArrowLeft size={16} /> Back to projects</Link>
    <section className="detail-hero"><div><div className="resource-card-top"><span className={`status-pill status-${project.status}`}>{project.status}</span><span className="resource-date">Created {formatDate(project.created_at)}</span></div><h1>{project.name}</h1><p>{project.description || 'No description added yet.'}</p></div><div className="detail-actions"><button className="secondary-button" type="button" onClick={() => setFormMode('project')}><Pencil size={16} /> Edit</button><button className="danger-button" type="button" onClick={() => setDeleteProjectOpen(true)}><Trash2 size={16} /> Delete</button></div></section>
    {notice && <div className="success-banner" role="status">{notice}</div>}
    {error && <ErrorState message={error} onRetry={load} />}
    <div className="detail-meta"><div><span>Project type</span><strong>{project.project_type}</strong></div><div><span>Last updated</span><strong>{formatDate(project.updated_at)}</strong></div><div><span>Sites</span><strong>{sites.length}</strong></div></div>
    <section className="nested-section"><div className="section-heading"><div><span className="eyebrow">Project inventory</span><h2>Geographic sites</h2></div><button className="primary-button" type="button" onClick={() => setFormMode('site')}><Plus size={17} /> Add site</button></div>
      {sites.length === 0 ? <EmptyState title="No sites in this project yet." description="Add a site with a temporary Polygon GeoJSON boundary. A map selector comes later." action={<button className="secondary-button" type="button" onClick={() => setFormMode('site')}><MapPinned size={17} /> Add first site</button>} /> : <div className="site-list">{sites.map((site) => <article className="site-row" key={site.id}><div className="site-symbol"><MapPinned size={19} /></div><div className="site-row-copy"><h3>{site.name}</h3><p>{site.description || 'No description added yet.'}</p></div><div className="site-area"><span>Area</span><strong>{site.area_hectares ?? '—'} ha</strong></div><div className="card-actions"><button className="secondary-button compact" type="button" onClick={() => navigate(`/projects/${projectId}/sites/${site.id}`)}>View</button><button className="icon-button" type="button" aria-label={`Edit ${site.name}`} onClick={() => setFormMode(`edit-site:${site.id}`)}><Pencil size={16} /></button><button className="icon-button danger-icon" type="button" aria-label={`Delete ${site.name}`} onClick={() => setDeleteTarget(site)}><Trash2 size={16} /></button></div></article>)}</div>}
    </section>
    <ProjectAnalyticsSection projectId={projectId} />
    {formMode === 'project' && <Modal title="Edit project" onClose={() => setFormMode(null)}><ProjectForm project={project} onCancel={() => setFormMode(null)} onSuccess={(value) => { setProject(value); setFormMode(null); setNotice('Project updated.') }} /></Modal>}
    {formMode === 'site' && <Modal title="Add site" description="Map-based boundary selection will replace this development input later." onClose={() => setFormMode(null)}><SiteForm projectId={projectId} onCancel={() => setFormMode(null)} onSuccess={(value) => { setSites((current) => [value, ...current]); setFormMode(null); setNotice('Site added.') }} /></Modal>}
    {formMode?.startsWith('edit-site:') && <Modal title="Edit site" onClose={() => setFormMode(null)}><SiteForm projectId={projectId} site={sites.find((site) => site.id === formMode.split(':')[1])} onCancel={() => setFormMode(null)} onSuccess={(value) => { setSites((current) => current.map((site) => site.id === value.id ? value : site)); setFormMode(null); setNotice('Site updated.') }} /></Modal>}
    {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.name}?`} description="This permanently removes the site and its associated metric records." isLoading={isDeleting} onClose={() => setDeleteTarget(null)} onConfirm={removeSite} />}
    {deleteProjectOpen && <ConfirmDialog title={`Delete ${project.name}?`} description="This removes the project. Its associated sites may also be affected by the backend cascade." isLoading={isDeleting} onClose={() => setDeleteProjectOpen(false)} onConfirm={removeProject} />}
  </div>
}
