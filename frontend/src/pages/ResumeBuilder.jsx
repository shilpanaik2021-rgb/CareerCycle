import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

function ScoreGauge({ score }) {
  const r = 65, c = 2 * Math.PI * r
  const offset = c - (score / 100) * c
  const color = score >= 75 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)'
  const cls = score >= 75 ? 'ats-green' : score >= 50 ? 'ats-yellow' : 'ats-red'

  return (
    <div className="ats-gauge">
      <svg width="160" height="160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className={`ats-gauge-text ${cls}`}>{score}%</span>
    </div>
  )
}

export default function ResumeBuilder() {
  const addToast = useToast()
  const [jd, setJd] = useState('')
  const [resume, setResume] = useState(null)
  const [score, setScore] = useState(null)
  const [found, setFound] = useState([])
  const [missing, setMissing] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [bullets, setBullets] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [tailoring, setTailoring] = useState(false)
  const [summary, setSummary] = useState('')
  const [skills, setSkills] = useState('')

  useEffect(() => {
    axios.get(`${API}/api/resume`).then(r => {
      setResume(r.data)
      setSummary(r.data.summary)
      setSkills(r.data.skills?.join(', ') || '')
    }).catch(() => {})
  }, [])

  const analyze = async () => {
    if (!jd.trim()) return addToast('Paste a job description first', 'error')
    setAnalyzing(true)
    try {
      const r = await axios.post(`${API}/api/ats/analyze`, {
        job_description: jd,
        resume: resume?.full_text || ''
      })
      setScore(r.data.score)
      setFound(r.data.found_keywords || [])
      setMissing(r.data.missing_keywords || [])
      setSuggestions(r.data.suggestions || [])
    } catch (err) { addToast('Analysis failed', 'error') }
    setAnalyzing(false)
  }

  const tailorBullets = async () => {
    if (!jd.trim()) return addToast('Paste a job description first', 'error')
    setTailoring(true)
    try {
      const r = await axios.post(`${API}/api/ats/tailor-bullets`, {
        job_description: jd,
        resume: resume?.full_text || ''
      })
      setBullets(r.data.bullets || [])
      addToast('Tailored bullets generated!', 'success')
    } catch (err) { addToast(err.response?.data?.detail || 'Failed', 'error') }
    setTailoring(false)
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Resume Builder</h1></div>

      <div className="split-pane" style={{ gap: 24 }}>
        <div style={{ width: '45%' }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <label>Paste Job Description</label>
            <textarea rows={14} value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the full job description here..." />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary btn-lg" onClick={analyze} disabled={analyzing} style={{ flex: 1 }}>
                {analyzing ? <><span className="spinner" /> Analyzing...</> : '🔍 Analyze Match'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ width: '55%' }}>
          {score === null ? (
            <div className="empty-state" style={{ height: 300 }}>
              <svg viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="50" stroke="var(--border)" strokeWidth="2"/><path d="M60 30v30l20 15" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/></svg>
              <h3>Paste a job description and click Analyze</h3>
              <p>We'll score how well your resume matches</p>
            </div>
          ) : (
            <>
              <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 8 }}>ATS Match Score</h3>
                <ScoreGauge score={score} />
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>✅ Keywords Found ({found.length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {found.slice(0, 30).map(k => <span key={k} className="keyword-tag keyword-found">✅ {k}</span>)}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>❌ Missing Keywords ({missing.length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {missing.slice(0, 20).map(k => <span key={k} className="keyword-tag keyword-missing">❌ {k}</span>)}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>💡 Suggestions</h3>
                <ul style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                  {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <button className="btn btn-primary" onClick={tailorBullets} disabled={tailoring} style={{ marginBottom: 16 }}>
                {tailoring ? <><span className="spinner" /> Generating...</> : '✍️ Generate Tailored Resume Bullets'}
              </button>

              {bullets.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize: 14, marginBottom: 12 }}>Before / After Bullet Points</h3>
                  {bullets.map((b, i) => (
                    <div key={i} style={{ marginBottom: 16, fontSize: 13 }}>
                      <div style={{ background: 'rgba(248,81,73,0.08)', padding: 10, borderRadius: 'var(--radius-sm)', marginBottom: 6, borderLeft: '3px solid var(--accent-red)' }}>
                        <strong style={{ color: 'var(--accent-red)', fontSize: 11 }}>ORIGINAL</strong>
                        <p style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{b.original}</p>
                      </div>
                      <div style={{ background: 'rgba(63,185,80,0.08)', padding: 10, borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-green)' }}>
                        <strong style={{ color: 'var(--accent-green)', fontSize: 11 }}>TAILORED</strong>
                        <p style={{ marginTop: 4 }}>{b.tailored}</p>
                        {b.keywords_added && <div style={{ marginTop: 4 }}>{b.keywords_added.map(k => <span key={k} className="keyword-tag keyword-found" style={{ fontSize: 10 }}>{k}</span>)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Resume Sections */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Your Resume</h2>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Professional Summary</label>
            <textarea rows={4} value={summary} onChange={e => setSummary(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Skills</label>
            <textarea rows={3} value={skills} onChange={e => setSkills(e.target.value)} />
          </div>
        </div>

        {resume?.experience?.map((exp, i) => (
          <div key={i} className="card" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 14 }}>{exp.title}</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{exp.company} | {exp.dates}</p>
            <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
