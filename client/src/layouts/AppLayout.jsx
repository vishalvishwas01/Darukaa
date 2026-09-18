import { FolderKanban, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${isMenuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">D</span>
          <div>
            <strong>Darukaa</strong>
            <span>.Earth</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink to="/dashboard" className="nav-item" onClick={closeMenu}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>
          <NavLink to="/projects" className="nav-item" onClick={closeMenu}>
            <FolderKanban size={18} />
            Projects
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <p>Earth intelligence, grounded in place.</p>
          <button className="logout-button" type="button" onClick={logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      {isMenuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={closeMenu} />}
      <section className="app-main">
        <header className="app-header">
          <button className="icon-button mobile-menu" type="button" aria-label="Open navigation" onClick={() => setIsMenuOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="header-context">
            <span className="eyebrow">Workspace</span>
            <span className="header-title">Field operations</span>
          </div>
          <div className="user-chip">
            <span className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span>{user?.name || user?.email}</span>
          </div>
          <button className="icon-button mobile-close" type="button" aria-label="Close navigation" onClick={closeMenu}>
            <X size={21} />
          </button>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </section>
    </div>
  )
}
