export default function StatsBar({ stats, loading }) {
  if (loading) {
    return (
      <div className="stats-row">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton skeleton-stat" />)}
      </div>
    )
  }

  const items = [
    { label: 'Total Jobs', value: stats.total || 0, cls: 'stat-blue', icon: '💼' },
    { label: 'Applied', value: stats.applied || 0, cls: 'stat-green', icon: '📤' },
    { label: 'Interviews', value: stats.interview || 0, cls: 'stat-yellow', icon: '🎯' },
    { label: 'Offers', value: stats.offer || 0, cls: 'stat-orange', icon: '🌟' },
    { label: 'Response Rate', value: `${stats.response_rate || 0}%`, cls: 'stat-purple', icon: '📈' },
  ]

  return (
    <div className="stats-row">
      {items.map(item => (
        <div key={item.label} className={`card stat-card ${item.cls}`}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
          <div className="stat-number">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  )
}
