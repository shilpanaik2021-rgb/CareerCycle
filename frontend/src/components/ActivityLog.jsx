import { useState, useEffect, useRef } from 'react'

export default function ActivityLog({ logs, running }) {
  const [collapsed, setCollapsed] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [logs])

  const getClass = (type) => {
    const map = { success: 'log-success', error: 'log-error', progress: 'log-progress', info: 'log-info' }
    return map[type] || 'log-info'
  }

  return (
    <div className="activity-log">
      <div className="activity-log-header" onClick={() => setCollapsed(!collapsed)}>
        <span>
          {running
            ? <><span className="spinner" style={{ marginRight: 8 }} />Running...</>
            : <><span style={{ color: 'var(--accent-green)' }}>●</span> Activity Log</>
          }
        </span>
        <span>{collapsed ? '▸' : '▾'}</span>
      </div>
      {!collapsed && (
        <div ref={bodyRef} className={`activity-log-body ${running ? 'expanded' : ''}`}>
          {logs.length === 0 && (
            <div className="log-line log-ready">● Ready — click an action to begin</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`log-line ${getClass(log.type)}`}>{log.message}</div>
          ))}
        </div>
      )}
    </div>
  )
}
