import Modal from './Modal'

export default function ConfirmDialog({ title, description, confirmLabel = 'Delete', isLoading, onConfirm, onClose }) {
  return <Modal title={title} description={description} onClose={onClose}>
    <div className="confirm-actions">
      <button className="secondary-button" type="button" onClick={onClose} disabled={isLoading}>Cancel</button>
      <button className="danger-button" type="button" onClick={onConfirm} disabled={isLoading}>{isLoading ? 'Deleting...' : confirmLabel}</button>
    </div>
  </Modal>
}
