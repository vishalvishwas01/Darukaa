import { Leaf } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Darukaa.Earth introduction">
        <Link className="brand-lockup" to="/login">
          <span className="brand-mark">D</span>
          <span>Darukaa<span>.Earth</span></span>
        </Link>
        <div className="visual-copy">
          <Leaf size={20} />
          <p>Restoration intelligence for a living planet.</p>
        </div>
        <div className="visual-coordinate">28.6139° N / 77.2090° E</div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </section>
    </main>
  )
}
