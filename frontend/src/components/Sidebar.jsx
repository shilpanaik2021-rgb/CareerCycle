import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL

const links = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/jobs', icon: '💼', label: 'Jobs' },
  { to: '/cover-letters', icon: '✍️', label: 'Cover Letters' },
  { to: '/resume', icon: '📄', label: 'Resume Builder' },
  { to: '/settings', icon: '⚙️', label: 'Settings' },
]

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation()
  const [lastSearched, setLastSearched] = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/last-searched`).then(r => {
      if (r.data.timestamp) {
        setLastSearched(new Date(r.data.timestamp).toLocaleString())
      }
    }).catch(() => {})
  }, [location])

  return (
    <>
      {isOpen && <div className="side-panel-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">🏥 Job Hunter</div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">SN</div>
          <div className="sidebar-user-name">Shilpa Naik</div>
        </div>
        <nav className="sidebar-nav">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span>{l.icon}</span>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {lastSearched ? `Last searched: ${lastSearched}` : 'No searches yet'}
        </div>
      </aside>
    </>
  )
}
