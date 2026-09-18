import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { normalizeApiError } from '../../../services/api'
import { createProject, updateProject } from '../../../api/projectApi'

const emptyForm = { name: '', description: '', project_type: '' }

export default function ProjectForm({ project, onSuccess, onCancel }) {
  const [form, setForm] = useState(() => project ? { name: project.name || '', description: project.description || '', project_type: project.project_type || '' } : emptyForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.project_type.trim()) {
      setError('Project name and project type are required.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null, project_type: form.project_type.trim() }
      const response = project
        ? await updateProject(project.id, payload)
        : await createProject(payload)
      onSuccess(response.data)
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <form className="resource-form" onSubmit={submit} noValidate>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <label className="field-label" htmlFor="project-name">Project name</label>
    <input id="project-name" className="text-input" name="name" value={form.name} onChange={updateField} maxLength={200} required />
    <label className="field-label" htmlFor="project-type">Project type</label>
    <input id="project-type" className="text-input" name="project_type" value={form.project_type} onChange={updateField} maxLength={50} placeholder="e.g. reforestation" required />
    <label className="field-label" htmlFor="project-description">Description <span className="field-hint">Optional</span></label>
    <textarea id="project-description" className="text-input text-area" name="description" value={form.description} onChange={updateField} maxLength={10000} rows={4} />
    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
      <button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting && <LoaderCircle className="spin" size={17} />}{isSubmitting ? 'Saving...' : project ? 'Save changes' : 'Create project'}</button>
    </div>
  </form>
}
