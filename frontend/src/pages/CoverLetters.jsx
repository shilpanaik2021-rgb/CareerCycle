import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

export default function CoverLetters() {
  const addToast = useToast()
  const [jobs, setJobs] = useState([])
  const [selected, setSelected] = useState(null)
  const [letterText, setLetterText] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    axios.get(`${API}/api/jobs`).then(r => { setJobs(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const selectJob = async (job) => {
    setSelected(job)
    try {
      const r = await axios.get(`${API}/api/jobs/${job.id}/cover-letter`)
      setLetterText(r.data.text || '')
    } catch { setLetterText('') }
  }

  const generate = async () => {
    if (!selected) return
    setGenerating(true)
    try {
      const r = await axios.post(`${API}/api/jobs/${selected.id}/cover-letter`)
      setLetterText(r.data.text)
      addToast('Cover letter generated!', 'success')
      // Refresh jobs list to update status
      const jr = await axios.get(`${API}/api/jobs`)
      setJobs(jr.data)
    } catch (err) { addToast(err.response?.data?.detail || 'Generation failed', 'error') }
    setGenerating(false)
  }

  const generateAllMissing = async () => {
    setGenerating(true)
    try {
      await axios.post(`${API}/api/cover-letters/generate-all`)
      addToast('Generating all cover letters in background...', 'success')
    } catch (err) { addToast(err.response?.data?.detail || 'Failed', 'error') }
    setGenerating(false)
  }

  const saveLetter = useCallback((text) => {
    if (!selected) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      axios.put(`${API}/api/jobs/${selected.id}/cover-letter`, { text }).catch(() => {})
    }, 2000)
  }, [selected])

  const handleEdit = (text) => {
    setLetterText(text)
    saveLetter(text)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(letterText)
    addToast('Copied to clipboard!', 'success')
  }

  const downloadDocx = () => {
    if (!selected) return
    window.open(`${API}/api/jobs/${selected.id}/cover-letter/download`, '_blank')
    addToast('Downloading .docx...', 'success')
  }

  const getStatus = (job) => {
    if (job.cover_letter_path) return 'Generated'
    return 'Missing'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cover Letters</h1>
        <button className="btn btn-primary" onClick={generateAllMissing} disabled={generating}>
          {generating ? <><span className="spinner" /> Generating...</> : '✍️ Generate All Missing'}
        </button>
      </div>

      <div className="split-pane">
        <div className="split-left">
          {loading ? (
            [1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-card" />)
          ) : jobs.length === 0 ? (
            <div className="empty-state"><h3>No jobs found</h3><p>Search for jobs first</p></div>
          ) : (
            jobs.map(job => {
              const status = getStatus(job)
              return (
                <div key={job.id} className={`cl-list-item ${selected?.id === job.id ? 'active' : ''}`} onClick={() => selectJob(job)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.company}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</div>
                  </div>
                  <span className={`status-badge ${status === 'Generated' ? 'status-applied' : 'status-not-applied'}`}>{status}</span>
                </div>
              )
            })
          )}
        </div>

        <div className="split-right">
          {!selected ? (
            <div className="empty-state" style={{ height: '100%' }}>
              <svg viewBox="0 0 120 120" fill="none"><rect x="25" y="15" width="70" height="90" rx="4" stroke="var(--border)" strokeWidth="2"/><line x1="35" y1="35" x2="85" y2="35" stroke="var(--text-muted)" strokeWidth="2"/><line x1="35" y1="50" x2="85" y2="50" stroke="var(--text-muted)" strokeWidth="2"/><line x1="35" y1="65" x2="70" y2="65" stroke="var(--text-muted)" strokeWidth="2"/></svg>
              <h3>Select a job to preview its cover letter</h3>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, marginBottom: 4 }}>{selected.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{selected.company} • {selected.location}</p>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={generate} disabled={generating}>
                  {generating ? <><span className="spinner" /> Generating...</> : '♻️ Regenerate with AI'}
                </button>
                <button className="btn" onClick={copyToClipboard} disabled={!letterText}>📋 Copy</button>
                <button className="btn" onClick={downloadDocx} disabled={!letterText}>📄 Download .docx</button>
              </div>

              {letterText ? (
                <>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 16, color: 'var(--text-primary)' }}>
                    {letterText}
                  </div>
                  <div className="form-group">
                    <label>Edit Cover Letter (auto-saves)</label>
                    <textarea rows={12} value={letterText} onChange={e => handleEdit(e.target.value)} />
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>No cover letter yet</h3>
                  <p>Click "Regenerate with AI" to create one</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
