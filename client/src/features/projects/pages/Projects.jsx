import { FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteProject, listProjects } from '../../../api/projectApi'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/AsyncState'
import Modal from '../../../components/common/Modal'
import { normalizeApiError } from '../../../services/api'
import ProjectForm from '../components/ProjectForm'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : '—'

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [formProject, setFormProject] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await listProjects()
      setProjects(response.data)
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const load = async () => loadProjects()
    load()
  }, [loadProjects])

  const removeProject = async () => {
    setIsDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      setProjects((current) => current.filter((project) => project.id !== deleteTarget.id))
      setDeleteTarget(null)
      setNotice('Project deleted.')
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsDeleting(false)
    }
  }

  return <div className="resource-page">
    <section className="resource-hero">
      <div><span className="eyebrow">Workspace / Projects</span><h1>Projects</h1><p>Keep restoration work organized, owned, and ready for the field.</p></div>
      <button className="primary-button" type="button" onClick={() => setFormProject(null)}><Plus size={17} /> Create project</button>
    </section>
    {notice && <div className="success-banner" role="status">{notice}</div>}
    {isLoading && <LoadingState label="Loading projects..." />}
    {!isLoading && error && <ErrorState message={error} onRetry={loadProjects} />}
    {!isLoading && !error && projects.length === 0 && <EmptyState title="You have not created any projects yet." description="Create your first project to start organizing sites and field work." action={<button className="secondary-button" type="button" onClick={() => setFormProject(null)}><FolderPlus size={17} /> Create first project</button>} />}
    {!isLoading && !error && projects.length > 0 && <div className="resource-grid">
      {projects.map((project) => <article className="resource-card" key={project.id}>
        <div className="resource-card-top"><span className={`status-pill status-${project.status}`}>{project.status}</span><span className="resource-date">{formatDate(project.created_at)}</span></div>
        <h2>{project.name}</h2><p>{project.description || 'No description added yet.'}</p>
        <div className="resource-meta"><span>Type</span><strong>{project.project_type}</strong></div>
        <div className="card-actions"><button className="secondary-button compact" type="button" onClick={() => navigate(`/projects/${project.id}`)}>Open project</button><button className="icon-button" type="button" aria-label={`Edit ${project.name}`} onClick={() => setFormProject(project)}><Pencil size={17} /></button><button className="icon-button danger-icon" type="button" aria-label={`Delete ${project.name}`} onClick={() => setDeleteTarget(project)}><Trash2 size={17} /></button></div>
      </article>)}
    </div>}
    {formProject !== undefined && <Modal title={formProject ? 'Edit project' : 'Create project'} description="Ownership and status are managed by the workspace." onClose={() => setFormProject(undefined)}><ProjectForm project={formProject} onCancel={() => setFormProject(undefined)} onSuccess={(project) => { setFormProject(undefined); setNotice(formProject ? 'Project updated.' : 'Project created.'); setProjects((current) => formProject ? current.map((item) => item.id === project.id ? project : item) : [project, ...current]) }} /></Modal>}
    {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.name}?`} description="This removes the project. Associated sites may also be affected by the backend cascade." isLoading={isDeleting} onClose={() => setDeleteTarget(null)} onConfirm={removeProject} />}
  </div>
}
