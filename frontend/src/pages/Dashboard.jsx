import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import StatsBar from '../components/StatsBar'
import ActivityLog from '../components/ActivityLog'
import Modal from '../components/Modal'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

const defaultSearch = {
  location: 'Orlando, Florida, United States',
  radius: 25,
  results_per_search: 15,
  max_days_old: 14,
  min_salary: 100000,
  include_remote: true,
  boards: ['linkedin', 'indeed', 'glassdoor', 'zip_recruiter'],
  job_titles: "Billing Manager Healthcare\nProfessional Billing Manager\nRevenue Cycle Manager\nPatient Accounts Manager\nMedical Billing Manager\nRevenue Cycle Director\nHealthcare Revenue Cycle Manager\nProfessional Billing Supervisor\nRemote Revenue Cycle Manager\nRemote Billing Manager Healthcare\nRemote Professional Billing Manager",
}

export default function Dashboard() {
  const addToast = useToast()
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [running, setRunning] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [search, setSearch] = useState(defaultSearch)
  const [recentJobs, setRecentJobs] = useState([])
  const pollRef = useRef(null)

  const fetchStats = useCallback(() => {
    axios.get(`${API}/api/stats`).then(r => { setStats(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const fetchRecent = useCallback(() => {
    axios.get(`${API}/api/jobs?status=Applied&sort=date_desc`).then(r => setRecentJobs(r.data.slice(0, 5))).catch(() => {})
  }, [])

  useEffect(() => { fetchStats(); fetchRecent() }, [])

  useEffect(() => {
    if (running) {
      pollRef.current = setInterval(() => {
        axios.get(`${API}/api/logs`).then(r => {
          setLogs(r.data.logs || [])
          if (!r.data.running) { setRunning(false); clearInterval(pollRef.current); fetchStats(); fetchRecent() }
        }).catch(() => {})
      }, 1500)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [running])

  const startSearch = async () => {
    setShowSearch(false)
    setRunning(true)
    setLogs([])
    try {
      const titles = search.job_titles.split('\n').filter(t => t.trim())
      await axios.post(`${API}/api/jobs/search`, { ...search, job_titles: titles })
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to start search', 'error')
      setRunning(false)
    }
  }

  const generateAll = async () => {
    setRunning(true); setLogs([])
    try {
      await axios.post(`${API}/api/cover-letters/generate-all`)
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed', 'error'); setRunning(false)
    }
  }

  const autoApply = async () => {
    setShowConfirm(false); setRunning(true); setLogs([])
    try {
      await axios.post(`${API}/api/auto-apply`)
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed', 'error'); setRunning(false)
    }
  }

  const exportCsv = () => {
    window.open(`${API}/api/export/csv`, '_blank')
    addToast('CSV download started', 'success')
  }

  const statusColor = (s) => {
    const m = { 'Not Applied': 'var(--text-secondary)', Applied: 'var(--accent-green)', Interview: 'var(--accent-yellow)', Offer: 'var(--accent-orange)', Rejected: 'var(--accent-red)' }
    return m[s] || 'var(--text-secondary)'
  }

  const pipelineData = [
    { label: 'Saved', count: stats.not_applied || 0, color: 'var(--text-muted)' },
    { label: 'Applied', count: stats.applied || 0, color: 'var(--accent-green)' },
    { label: 'Interview', count: stats.interview || 0, color: 'var(--accent-yellow)' },
    { label: 'Offer', count: stats.offer || 0, color: 'var(--accent-orange)' },
    { label: 'Rejected', count: stats.rejected || 0, color: 'var(--accent-red)' },
  ]
  const pipeTotal = pipelineData.reduce((s, p) => s + p.count, 0) || 1

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>

      <StatsBar stats={stats} loading={loading} />

      <div className="quick-actions">
        <button className={`action-btn ${running ? 'running' : ''}`} onClick={() => setShowSearch(true)} disabled={running}>
          <span className="icon">🔍</span>{running ? <><span className="spinner" /> Running...</> : 'Search for Jobs'}
        </button>
        <button className="action-btn" onClick={generateAll} disabled={running}>
          <span className="icon">✍️</span>Generate Cover Letters
        </button>
        <button className="action-btn" onClick={() => setShowConfirm(true)} disabled={running}>
          <span className="icon">🤖</span>Auto-Apply LinkedIn
        </button>
        <button className="action-btn" onClick={exportCsv} disabled={running}>
          <span className="icon">📊</span>Export CSV
        </button>
      </div>

      <ActivityLog logs={logs} running={running} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Recent Applications</h3>
          {recentJobs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No applications yet</div>}
          {recentJobs.map(job => (
            <div key={job.id} className="recent-card">
              <div className="recent-avatar">{(job.company || '?')[0]}</div>
              <div className="recent-info">
                <div className="recent-title">{job.title}</div>
                <div className="recent-company">{job.company}</div>
              </div>
              <span className={`status-badge status-${(job.status || '').toLowerCase().replace(/\s+/g, '-')}`}>{job.status}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 12 }}>Pipeline Summary</h3>
          <div className="pipeline-bar">
            {pipelineData.map(p => (
              <div key={p.label} className="pipeline-segment" style={{ flex: Math.max(p.count / pipeTotal, 0.05), background: p.color }}>
                {p.count > 0 ? p.count : ''}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
            {pipelineData.map(p => <span key={p.label} style={{ color: p.color }}>{p.label} ({p.count})</span>)}
          </div>
        </div>
      </div>

      {/* Search Settings Modal */}
      <Modal isOpen={showSearch} onClose={() => setShowSearch(false)} title="⚙️ Search Settings" footer={
        <><button className="btn" onClick={() => setShowSearch(false)}>Cancel</button><button className="btn btn-primary btn-lg" onClick={startSearch}>🔍 Start Searching</button></>
      }>
        <div className="form-grid">
          <div className="form-group">
            <label>Location</label>
            <input type="text" value={search.location} onChange={e => setSearch({ ...search, location: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Include Remote Jobs</label>
            <label className="toggle" style={{ marginTop: 4 }}>
              <input type="checkbox" checked={search.include_remote} onChange={e => setSearch({ ...search, include_remote: e.target.checked })} />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="form-group">
            <label>Radius (miles)</label>
            <div className="stepper">
              <button onClick={() => setSearch({ ...search, radius: Math.max(5, search.radius - 5) })}>−</button>
              <input type="number" value={search.radius} onChange={e => setSearch({ ...search, radius: +e.target.value })} style={{ width: 60 }} />
              <button onClick={() => setSearch({ ...search, radius: search.radius + 5 })}>+</button>
            </div>
          </div>
          <div className="form-group">
            <label>Results per search</label>
            <div className="stepper">
              <button onClick={() => setSearch({ ...search, results_per_search: Math.max(5, search.results_per_search - 5) })}>−</button>
              <input type="number" value={search.results_per_search} onChange={e => setSearch({ ...search, results_per_search: +e.target.value })} style={{ width: 60 }} />
              <button onClick={() => setSearch({ ...search, results_per_search: search.results_per_search + 5 })}>+</button>
            </div>
          </div>
          <div className="form-group">
            <label>Max days old</label>
            <div className="stepper">
              <button onClick={() => setSearch({ ...search, max_days_old: Math.max(1, search.max_days_old - 1) })}>−</button>
              <input type="number" value={search.max_days_old} onChange={e => setSearch({ ...search, max_days_old: +e.target.value })} style={{ width: 60 }} />
              <button onClick={() => setSearch({ ...search, max_days_old: search.max_days_old + 1 })}>+</button>
            </div>
          </div>
          <div className="form-group">
            <label>Min Salary ($)</label>
            <input type="number" value={search.min_salary} onChange={e => setSearch({ ...search, min_salary: +e.target.value })} />
          </div>
          <div className="form-group form-full">
            <label>Job Boards</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {['linkedin', 'indeed', 'glassdoor', 'zip_recruiter'].map(b => (
                <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={search.boards.includes(b)} onChange={e => {
                    setSearch({ ...search, boards: e.target.checked ? [...search.boards, b] : search.boards.filter(x => x !== b) })
                  }} />
                  {b === 'zip_recruiter' ? 'ZipRecruiter' : b.charAt(0).toUpperCase() + b.slice(1)}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group form-full">
            <label>Job Titles (one per line)</label>
            <textarea rows={6} value={search.job_titles} onChange={e => setSearch({ ...search, job_titles: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Auto-Apply Confirmation */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="🤖 Auto-Apply to LinkedIn" footer={
        <><button className="btn" onClick={() => setShowConfirm(false)}>Cancel</button><button className="btn btn-primary" onClick={autoApply}>Start Auto-Apply</button></>
      }>
        <p style={{ marginBottom: 12, fontSize: 14 }}>This will open Chrome and automatically apply to unapplied LinkedIn jobs using Easy Apply.</p>
        <p style={{ color: 'var(--accent-yellow)', fontSize: 13 }}>⚠️ Make sure your LinkedIn credentials are set in Settings before continuing.</p>
      </Modal>
    </div>
  )
}
