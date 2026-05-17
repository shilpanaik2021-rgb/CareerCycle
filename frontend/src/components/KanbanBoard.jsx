import { useState } from 'react'
import axios from 'axios'
import JobCard from './JobCard'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

const COLUMNS = [
  { status: 'Not Applied', title: '📋 Saved', color: 'var(--text-secondary)' },
  { status: 'Applied', title: '📤 Applied', color: 'var(--accent-green)' },
  { status: 'Interview', title: '🎯 Interview', color: 'var(--accent-yellow)' },
  { status: 'Offer', title: '🌟 Offer', color: 'var(--accent-orange)' },
  { status: 'Rejected', title: '❌ Rejected', color: 'var(--accent-red)' },
]

export default function KanbanBoard({ jobs, onRefresh, onGenLetter }) {
  const addToast = useToast()
  const [dragOverCol, setDragOverCol] = useState(null)

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    setDragOverCol(null)
    const jobId = e.dataTransfer.getData('text/plain')
    if (!jobId) return

    try {
      await axios.patch(`${API}/api/jobs/${jobId}/status`, { status: newStatus })
      addToast(`Moved to ${newStatus}`, 'success')
      onRefresh()
    } catch (err) {
      addToast('Failed to update status', 'error')
    }
  }

  return (
    <div className="kanban">
      {COLUMNS.map(col => {
        const colJobs = jobs.filter(j => j.status === col.status)
        return (
          <div key={col.status} className="kanban-column">
            <div className="kanban-header" style={{ borderBottomColor: col.color }}>
              <span>{col.title}</span>
              <span className="kanban-count">{colJobs.length}</span>
            </div>
            <div
              className={`kanban-body ${dragOverCol === col.status ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.status) }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {colJobs.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  Drop jobs here
                </div>
              )}
              {colJobs.map(job => (
                <JobCard key={job.id} job={job} onGenLetter={onGenLetter} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
