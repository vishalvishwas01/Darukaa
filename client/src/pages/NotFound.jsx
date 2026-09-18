import { ArrowLeft, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Compass size={30} />
      <span className="eyebrow">404 / off trail</span>
      <h1>This place is not mapped yet.</h1>
      <p>The page you were looking for does not exist in this workspace.</p>
      <Link className="secondary-button" to="/dashboard"><ArrowLeft size={17} /> Back to dashboard</Link>
    </main>
  )
}
