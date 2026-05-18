import { useState, useCallback, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Jobs from './pages/Jobs'
import CoverLetters from './pages/CoverLetters'
import ResumeBuilder from './pages/ResumeBuilder'
import ResumeAnalyzer from './pages/ResumeAnalyzer'
import Settings from './pages/Settings'

const ToastContext = createContext()
export const useToast = () => useContext(ToastContext)

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => removeToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [toasts, setToasts] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      <BrowserRouter>
        <div className="app-layout">
          <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/cover-letters" element={<CoverLetters />} />
              <Route path="/resume" element={<ResumeBuilder />} />
              <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
          <ResumeAnalyzer chatOnly />
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </BrowserRouter>
    </ToastContext.Provider>
  )
}
