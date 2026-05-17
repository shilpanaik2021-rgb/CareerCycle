import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

export default function Settings() {
  const addToast = useToast()
  const [cfg, setCfg] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(() => {
    axios.get(`${API}/api/config`).then(r => { setCfg(r.data); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const update = (key, val) => setCfg(prev => ({ ...prev, [key]: val }))

  const save = async () => {
    setSaving(true)
    try {
      await axios.post(`${API}/api/config`, cfg)
      addToast('Settings saved!', 'success')
    } catch { addToast('Failed to save', 'error') }
    setSaving(false)
  }

  if (loading) return <div>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 120, marginBottom: 16 }} />)}</div>

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>

      <div className="settings-section">
        <h3>👤 Personal Info</h3>
        <div className="form-grid">
          <div className="form-group"><label>Name</label><input type="text" value={cfg.name || ''} onChange={e => update('name', e.target.value)} /></div>
          <div className="form-group"><label>Email</label><input type="email" value={cfg.email || ''} onChange={e => update('email', e.target.value)} /></div>
          <div className="form-group"><label>Phone</label><input type="text" value={cfg.phone || ''} onChange={e => update('phone', e.target.value)} /></div>
          <div className="form-group"><label>Location</label><input type="text" value={cfg.location || ''} onChange={e => update('location', e.target.value)} /></div>
          <div className="form-group form-full"><label>LinkedIn URL</label><input type="url" value={cfg.linkedin_url || ''} onChange={e => update('linkedin_url', e.target.value)} /></div>
        </div>
      </div>

      <div className="settings-section">
        <h3>🔑 API Keys</h3>
        <div className="form-grid">
          <div className="form-group form-full">
            <label>Gemini API Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type={showKey ? 'text' : 'password'} value={cfg.gemini_api_key || ''} onChange={e => update('gemini_api_key', e.target.value)} style={{ flex: 1 }} />
              <button className="btn" onClick={() => setShowKey(!showKey)}>{showKey ? '🙈' : '👁️'}</button>
            </div>
          </div>
          <div className="form-group"><label>LinkedIn Email</label><input type="email" value={cfg.linkedin_email || ''} onChange={e => update('linkedin_email', e.target.value)} /></div>
          <div className="form-group">
            <label>LinkedIn Password</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type={showPwd ? 'text' : 'password'} value={cfg.linkedin_password || ''} onChange={e => update('linkedin_password', e.target.value)} style={{ flex: 1 }} />
              <button className="btn" onClick={() => setShowPwd(!showPwd)}>{showPwd ? '🙈' : '👁️'}</button>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>🔍 Search Defaults</h3>
        <div className="form-grid">
          <div className="form-group"><label>Search Location</label><input type="text" value={cfg.search_location || ''} onChange={e => update('search_location', e.target.value)} /></div>
          <div className="form-group"><label>Radius (miles)</label><input type="number" value={cfg.radius_miles || 25} onChange={e => update('radius_miles', +e.target.value)} /></div>
          <div className="form-group"><label>Results per search</label><input type="number" value={cfg.results_per_search || 15} onChange={e => update('results_per_search', +e.target.value)} /></div>
          <div className="form-group"><label>Max days old</label><input type="number" value={cfg.max_days_old || 14} onChange={e => update('max_days_old', +e.target.value)} /></div>
          <div className="form-group"><label>Min Salary ($)</label><input type="number" value={cfg.min_salary || 100000} onChange={e => update('min_salary', +e.target.value)} /></div>
          <div className="form-group">
            <label>Include Remote</label>
            <label className="toggle" style={{ marginTop: 4 }}><input type="checkbox" checked={cfg.include_remote || false} onChange={e => update('include_remote', e.target.checked)} /><span className="toggle-slider" /></label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>🤖 Auto-Apply Settings</h3>
        <div className="form-grid">
          <div className="form-group"><label>Max Applications per Session</label><input type="number" value={cfg.max_applications || 10} onChange={e => update('max_applications', +e.target.value)} /></div>
          <div className="form-group"><label>Wait Between Applications (sec)</label><input type="number" value={cfg.wait_between || 30} onChange={e => update('wait_between', +e.target.value)} /></div>
        </div>
      </div>

      <div className="settings-section">
        <h3>🔔 Notification Preferences</h3>
        <div className="form-grid">
          <div className="form-group"><label>Email notifications</label><label className="toggle" style={{ marginTop: 4 }}><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
          <div className="form-group"><label>Sound on completion</label><label className="toggle" style={{ marginTop: 4 }}><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label></div>
        </div>
      </div>

      <button className="btn btn-success btn-lg" onClick={save} disabled={saving} style={{ marginTop: 8 }}>
        {saving ? <><span className="spinner" /> Saving...</> : '💾 Save All Settings'}
      </button>
    </div>
  )
}
