import { ArrowUpRight, BarChart3, FolderKanban, MapPinned } from 'lucide-react'
import useAuth from '../../../hooks/useAuth'

const modules = [
  { icon: FolderKanban, title: 'Projects', text: 'Organize restoration work and keep ownership clear.', state: 'Coming next' },
  { icon: MapPinned, title: 'Geographic sites', text: 'Bring field boundaries into one shared workspace.', state: 'Coming next' },
  { icon: BarChart3, title: 'Analytics', text: 'Track performance over time when your data is ready.', state: 'Coming next' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h1>Good morning, {firstName}.</h1>
          <p>One calm place to coordinate the work of restoring living landscapes.</p>
        </div>
        <div className="hero-note">
          <span className="status-dot" />
          <span>Workspace ready</span>
        </div>
      </section>
      <section className="module-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">The field guide</span>
            <h2>Build from the ground up.</h2>
          </div>
          <span className="section-count">03 modules</span>
        </div>
        <div className="module-grid">
          {modules.map(({ icon: Icon, title, text, state }) => (
            <article className="module-card" key={title}>
              <div className="module-icon"><Icon size={21} /></div>
              <div className="module-card-copy">
                <span className="module-state">{state}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ArrowUpRight className="module-arrow" size={20} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
