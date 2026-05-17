import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import KanbanBoard from '../components/KanbanBoard'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

const STATUSES = ['Not Applied', 'Applied', 'Interview', 'Offer', 'Rejected']

function sourceBadge(source) {
  const s = (source || '').toLowerCase().replace(/\s+/g, '')
  const names = { linkedin: 'LinkedIn', indeed: 'Indeed', glassdoor: 'Glassdoor', zip_recruiter: 'ZipRecruiter', ziprecruiter: 'ZipRecruiter' }
  return <span className={`badge badge-${s}`}>{names[s] || source}</span>
}

function statusClass(s) { return `status-${(s || '').toLowerCase().replace(/\s+/g, '-')}` }

export default function Jobs() {
  const addToast = useToast()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('table')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [sort, setSort] = useState('date_desc')
  const [panel, setPanel] = useState(null)
  const [notes, setNotes] = useState('')
  const notesTimer = useRef(null)

  const fetchJobs = useCallback(() => {
    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.append('status', filterStatus)
    if (filterSource !== 'all') params.append('source', filterSource)
    if (search) params.append('q', search)
    params.append('sort', sort)
    axios.get(`${API}/api/jobs?${params}`).then(r => { setJobs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [filterStatus, filterSource, search, sort])

  useEffect(() => { fetchJobs() }, [fetchJobs])

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/api/jobs/${id}/status`, { status })
      addToast(`Status updated to ${status}`, 'success')
      fetchJobs()
      if (panel && panel.id === id) setPanel({ ...panel, status })
    } catch { addToast('Failed to update', 'error') }
  }

  const deleteJob = async (id) => {
    if (!confirm('Delete this job?')) return
    try {
      await axios.delete(`${API}/api/jobs/${id}`)
      addToast('Job deleted', 'success')
      fetchJobs()
      if (panel && panel.id === id) setPanel(null)
    } catch { addToast('Failed to delete', 'error') }
  }

  const genLetter = async (job) => {
    addToast('Generating cover letter...', 'success')
    try {
      await axios.post(`${API}/api/jobs/${job.id}/cover-letter`)
      addToast('Cover letter generated!', 'success')
      fetchJobs()
    } catch (err) { addToast(err.response?.data?.detail || 'Failed', 'error') }
  }

  const openPanel = (job) => { setPanel(job); setNotes(job.notes || '') }

  const saveNotes = useCallback((id, text) => {
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      axios.patch(`${API}/api/jobs/${id}/notes`, { notes: text }).catch(() => {})
    }, 1500)
  }, [])

  const handleNotesChange = (text) => {
    setNotes(text)
    if (panel) saveNotes(panel.id, text)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Jobs</h1>
        <div className="view-toggle">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>📋 Table</button>
          <button className={view === 'kanban' ? 'active' : ''} onClick={() => setView('kanban')}>🗂️ Kanban</button>
        </div>
      </div>

      {view === 'table' && (
        <>
          <div className="filter-bar">
            <input type="text" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
              <option value="all">All Sources</option>
              <option value="linkedin">LinkedIn</option>
              <option value="indeed">Indeed</option>
              <option value="glassdoor">Glassdoor</option>
              <option value="zip_recruiter">ZipRecruiter</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="company">Company A-Z</option>
              <option value="title">Title A-Z</option>
            </select>
            <span className="count">Showing {jobs.length} jobs</span>
          </div>

          {loading ? (
            <div>{[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-card" />)}</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="50" stroke="var(--border)" strokeWidth="2"/><path d="M40 65c0-11 8.9-20 20-20s20 9 20 20" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/><circle cx="45" cy="50" r="3" fill="var(--text-muted)"/><circle cx="75" cy="50" r="3" fill="var(--text-muted)"/></svg>
              <h3>No jobs found</h3>
              <p>Run a search from the Dashboard to find jobs</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr>
                  <th>Title</th><th>Company</th><th>Location</th><th>Source</th><th>Date</th><th>Salary</th><th>Status</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {jobs.map(job => (
                    <tr key={job.id} className={`status-row-${(job.status||'').toLowerCase().replace(/\s+/g,'-')}`} onClick={() => openPanel(job)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</td>
                      <td>{job.company}</td>
                      <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.location}</td>
                      <td>{sourceBadge(job.source)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{job.date_posted ? new Date(job.date_posted).toLocaleDateString() : '—'}</td>
                      <td style={{ fontSize: 12 }}>{job.salary || '—'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <select className={`status-badge ${statusClass(job.status)}`} value={job.status} onChange={e => updateStatus(job.id, e.target.value)}
                          style={{ background: 'transparent', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 10, fontSize: 11, cursor: 'pointer', color: 'inherit' }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {job.job_url && <button className="btn" onClick={() => window.open(job.job_url, '_blank')} title="Apply" style={{ padding: '3px 6px', fontSize: 11 }}>↗</button>}
                          <button className="btn" onClick={() => genLetter(job)} title="Generate Cover Letter" style={{ padding: '3px 6px', fontSize: 11 }}>✍️</button>
                          <button className="btn" onClick={() => deleteJob(job.id)} title="Delete" style={{ padding: '3px 6px', fontSize: 11 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'kanban' && <KanbanBoard jobs={jobs} onRefresh={fetchJobs} onGenLetter={genLetter} />}

      {/* Side Panel */}
      {panel && <div className="side-panel-overlay" onClick={() => setPanel(null)} />}
      <div className={`side-panel ${panel ? 'open' : ''}`}>
        {panel && (
          <>
            <div className="side-panel-header">
              <h3 style={{ fontSize: 16 }}>Job Details</h3>
              <button className="modal-close" onClick={() => setPanel(null)}>×</button>
            </div>
            <div className="side-panel-body">
              <h2 style={{ fontSize: 18, marginBottom: 4 }}>{panel.title}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{panel.company} • {panel.location}</p>
              {panel.salary && <p style={{ marginBottom: 8, fontSize: 14 }}>💰 {panel.salary}</p>}
              {panel.date_posted && <p style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>Posted: {new Date(panel.date_posted).toLocaleDateString()}</p>}

              <div className="form-group">
                <label>Status</label>
                <select value={panel.status} onChange={e => { updateStatus(panel.id, e.target.value); setPanel({ ...panel, status: e.target.value }) }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea rows={3} value={notes} onChange={e => handleNotesChange(e.target.value)} placeholder="Add notes..." />
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <button className="btn btn-primary" onClick={() => genLetter(panel)}>✍️ Generate Cover Letter</button>
                {panel.job_url && <button className="btn" onClick={() => window.open(panel.job_url, '_blank')}>Apply Now ↗</button>}
                <button className="btn btn-danger" onClick={() => deleteJob(panel.id)}>🗑️ Remove</button>
              </div>

              {panel.description && (
                <div>
                  <label>Job Description</label>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 12, lineHeight: 1.7, maxHeight: 400, overflowY: 'auto', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {panel.description}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
