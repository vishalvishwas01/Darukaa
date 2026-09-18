import { LoaderCircle, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { normalizeApiError } from '../../../services/api'
import { createSite, updateSite } from '../../../api/siteApi'
import MapView from './MapView'
import { validatePolygonBoundary } from '../utils/boundaryValidation'

export default function SiteForm({ projectId, site, onSuccess, onCancel }) {
  const [form, setForm] = useState(() => ({ name: site?.name || '', description: site?.description || '', boundary: site?.boundary || null }))
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }

  const updateBoundary = (boundary) => {
    setForm((current) => ({ ...current, boundary }))
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setError('Site name is required.')
      return
    }
    const boundaryError = validatePolygonBoundary(form.boundary)
    if (boundaryError) {
      setError(boundaryError)
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null, boundary: form.boundary }
      const response = site ? await updateSite(projectId, site.id, payload) : await createSite(projectId, payload)
      onSuccess(response.data)
    } catch (requestError) {
      setError(normalizeApiError(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return <form className="resource-form" onSubmit={submit} noValidate>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <div className="development-note"><strong>Interactive boundary editor</strong><span>Draw a Polygon on the map. The backend remains authoritative for geometry and area.</span></div>
    <label className="field-label" htmlFor="site-name">Site name</label>
    <input id="site-name" className="text-input" name="name" value={form.name} onChange={updateField} maxLength={200} required />
    <label className="field-label" htmlFor="site-description">Description <span className="field-hint">Optional</span></label>
    <textarea id="site-description" className="text-input text-area" name="description" value={form.description} onChange={updateField} maxLength={10000} rows={3} />
    <div className="map-field-heading"><span className="field-label">Boundary</span><button className="text-button" type="button" onClick={() => updateBoundary(null)} disabled={!form.boundary || isSubmitting}><RotateCcw size={15} /> Clear boundary</button></div>
    <MapView boundary={form.boundary} drawingEnabled onPolygonChange={updateBoundary} />
    <p className="boundary-status" role="status">{form.boundary ? 'Polygon selected. Select it on the map to edit.' : 'No polygon selected. Draw one to continue.'}</p>
    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
      <button className="primary-button" type="submit" disabled={isSubmitting || !form.boundary}>{isSubmitting && <LoaderCircle className="spin" size={17} />}{isSubmitting ? 'Saving...' : site ? 'Save changes' : 'Add site'}</button>
    </div>
  </form>
}
