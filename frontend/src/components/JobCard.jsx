function timeAgo(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function sourceBadge(source) {
  const s = (source || '').toLowerCase().replace(/\s+/g, '')
  const names = { linkedin: 'LinkedIn', indeed: 'Indeed', glassdoor: 'Glassdoor', zip_recruiter: 'ZipRecruiter', ziprecruiter: 'ZipRecruiter' }
  return <span className={`badge badge-${s}`}>{names[s] || source}</span>
}

export default function JobCard({ job, onDragStart, onApply, onGenLetter }) {
  return (
    <div
      className="job-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', job.id)
        e.currentTarget.classList.add('dragging')
        if (onDragStart) onDragStart(job)
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
    >
      <div className="job-card-company">{job.company}</div>
      <div className="job-card-title">{job.title}</div>
      <div className="job-card-meta">
        <span>📍 {job.location?.substring(0, 25)}</span>
        {job.is_remote === 'True' && <span className="badge badge-glassdoor">Remote</span>}
        {sourceBadge(job.source)}
        <span>{timeAgo(job.date_posted || job.date_added)}</span>
      </div>
      <div className="job-card-actions">
        {job.status === 'Not Applied' && job.job_url && (
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); window.open(job.job_url, '_blank') }} style={{ padding: '4px 8px', fontSize: 11 }}>Apply ↗</button>
        )}
        {!job.cover_letter_path && (
          <button className="btn" onClick={(e) => { e.stopPropagation(); onGenLetter && onGenLetter(job) }} style={{ padding: '4px 8px', fontSize: 11 }}>✍️</button>
        )}
        {job.cover_letter_path && <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>📄</span>}
      </div>
    </div>
  )
}
