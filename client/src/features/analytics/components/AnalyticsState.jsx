import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react'

export function AnalyticsLoading({ label = 'Loading analytics...' }) {
  return <div className="analytics-state" role="status"><LoaderCircle className="spin" size={19} /><span>{label}</span></div>
}

export function AnalyticsError({ message, onRetry }) {
  return <div className="analytics-state analytics-state-error" role="alert"><AlertCircle size={19} /><span>{message}</span>{onRetry && <button className="text-button" type="button" onClick={onRetry}><RefreshCw size={15} /> Retry</button>}</div>
}

export function AnalyticsEmpty({ children = 'No metrics are available for this selection yet.' }) {
  return <div className="analytics-empty"><span>{children}</span></div>
}
