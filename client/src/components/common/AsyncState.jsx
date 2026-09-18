import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'

export function LoadingState({ label = 'Loading...' }) {
  return <div className="async-state" role="status"><LoaderCircle className="spin" size={20} /><span>{label}</span></div>
}

export function ErrorState({ message, onRetry }) {
  return <div className="async-state async-error" role="alert"><AlertCircle size={20} /><span>{message}</span>{onRetry && <button className="text-button" type="button" onClick={onRetry}><RefreshCw size={15} /> Retry</button>}</div>
}

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><Inbox size={25} /><h3>{title}</h3><p>{description}</p>{action}</div>
}
