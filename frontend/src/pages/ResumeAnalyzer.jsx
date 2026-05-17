import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useToast } from '../App'

const API = import.meta.env.VITE_API_URL

export default function ResumeAnalyzer() {
  const addToast = useToast()
  
  // Page States: 'upload' | 'analyzing' | 'results'
  const [state, setState] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(true)
  
  // Resume File & Text Info
  const [file, setFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [isCustomUploaded, setIsCustomUploaded] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  
  // Streaming Data
  const [analysisText, setAnalysisText] = useState('')
  const [webSearches, setWebSearches] = useState([])
  const [currentQuery, setCurrentQuery] = useState('')
  const [score, setScore] = useState(0)
  const [scoreBreakdown, setScoreBreakdown] = useState({
    ats: 0, achievements: 0, keywords: 0, formatting: 0, narrative: 0
  })
  
  // Result States
  const [issues, setIssues] = useState([])
  const [selectedIssueId, setSelectedIssueId] = useState(null)
  const [resultsActiveTab, setResultsActiveTab] = useState('original') // 'original' | 'improved'
  const [improving, setImproving] = useState(false)
  const [improvedResumeText, setImprovedResumeText] = useState('')
  const [improvementSuggestions, setImprovementSuggestions] = useState('')

  // Chat States
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatResponding, setChatResponding] = useState(false)

  // Refs for scrolling and typewriter
  const analysisEndRef = useRef(null)
  const chatEndRef = useRef(null)
  const issueRefs = useRef({})

  // Fetch cached resume text on mount
  useEffect(() => {
    // Check if Gemini API key exists
    axios.get(`${API}/api/config`).then(r => {
      if (!r.data.gemini_api_key) {
        setHasApiKey(false)
      }
    }).catch(() => {})

    axios.get(`${API}/api/resume/text`).then(r => {
      if (r.data.text) {
        setResumeText(r.data.text)
        setIsCustomUploaded(r.data.uploaded)
        setWordCount(r.data.text.split(/\s+/).filter(Boolean).length)
      }
    }).catch(() => {})
  }, [])

  // Auto scroll to bottom of streaming analysis
  useEffect(() => {
    if (state === 'analyzing' && analysisEndRef.current) {
      analysisEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [analysisText, state])

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory])

  // PDF File Selection
  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && selected.type === 'application/pdf') {
      setFile(selected)
    } else {
      addToast('Please upload a valid PDF file', 'error')
    }
  }

  // Upload PDF file
  const uploadPdf = async () => {
    if (!file) return
    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const res = await axios.post(`${API}/api/resume/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResumeText(res.data.text_preview)
      setIsCustomUploaded(true)
      setWordCount(res.data.word_count)
      addToast('Resume uploaded and extracted successfully!', 'success')
      setLoading(false)
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to upload resume', 'error')
      setLoading(false)
    }
  }

  // Resiliently Parse Issues from Markdown
  const parseIssuesResilient = (text) => {
    const parsedIssues = []
    const blocks = text.split(/### Issue\s+/i)
    
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]
      const lines = block.split('\n')
      const headerLine = lines[0].trim()
      
      const titleMatch = headerLine.match(/^(\d+)?[:\s-]*(.*)/)
      const id = titleMatch ? parseInt(titleMatch[1]) || i : i
      const title = titleMatch ? titleMatch[2].trim() : headerLine

      let section = ''
      let problem = ''
      let currentText = ''
      let whyItHurts = ''
      let fix = ''

      block.split('\n').forEach(line => {
        const trimmed = line.trim()
        if (trimmed.toLowerCase().startsWith('**section:**')) {
          section = trimmed.replace(/\*\*section:\*\*/i, '').replace(/["']/g, '').trim()
        } else if (trimmed.toLowerCase().startsWith('**problem:**')) {
          problem = trimmed.replace(/\*\*problem:\*\*/i, '').trim()
        } else if (trimmed.toLowerCase().startsWith('**current text:**')) {
          currentText = trimmed.replace(/\*\*current text:\*\*/i, '').replace(/^["']|["']$/g, '').trim()
        } else if (trimmed.toLowerCase().startsWith('**why it hurts you:**')) {
          whyItHurts = trimmed.replace(/\*\*why it hurts you:\*\*/i, '').trim()
        } else if (trimmed.toLowerCase().startsWith('**fix it like this:**')) {
          fix = trimmed.replace(/\*\*fix it like this:\*\*/i, '').replace(/^["']|["']$/g, '').trim()
        }
      })

      if (currentText || problem) {
        parsedIssues.push({ id, title, section, problem, currentText, whyItHurts, fix, fixed: false })
      }
    }
    return parsedIssues
  }

  // Start Streaming Analysis
  const startAnalysis = () => {
    if (!hasApiKey) {
      addToast('Gemini API key is not configured. Please add it in Settings first.', 'warning')
      return
    }
    
    setState('analyzing')
    setAnalysisText('')
    setWebSearches([])
    setCurrentQuery('')
    setScore(0)
    setScoreBreakdown({ ats: 0, achievements: 0, keywords: 0, formatting: 0, narrative: 0 })

    const eventSource = new EventSource(`${API}/api/resume/analyze`)
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.type === 'text') {
        setAnalysisText(prev => prev + data.content)
      }
      
      if (data.type === 'search_start') {
        setCurrentQuery(data.query)
        setWebSearches(prev => [...prev, { query: data.query, results: [], done: false }])
      }
      
      if (data.type === 'search_result') {
        setWebSearches(prev => {
          return prev.map(search => {
            if (search.query === currentQuery) {
              return { ...search, results: [...search.results, { url: data.url, title: data.title }] }
            }
            return search
          })
        })
      }
      
      if (data.type === 'score') {
        setScore(data.overall)
        setScoreBreakdown(data.breakdown)
      }
      
      if (data.type === 'done') {
        eventSource.close()
        // Mark all searches done
        setWebSearches(prev => prev.map(s => ({ ...s, done: true })))
        setState('results')
        addToast('Resume analysis completed!', 'success')
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      setState('upload')
      addToast('Analysis interrupted — please try again', 'error')
    }
  }

  // Trigger parsing whenever analysisText finishes
  useEffect(() => {
    if (state === 'results' && analysisText) {
      const parsed = parseIssuesResilient(analysisText)
      setIssues(parsed)
      if (parsed.length > 0) {
        setSelectedIssueId(parsed[0].id)
      }
    }
  }, [state, analysisText])

  // Scroll to Specific Issue
  const scrollToIssue = (id) => {
    setSelectedIssueId(id)
    const element = issueRefs.current[id]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  // Toggle Issue Fixed status
  const toggleIssueFixed = (id) => {
    setIssues(prev => prev.map(issue => {
      if (issue.id === id) {
        return { ...issue, fixed: !issue.fixed }
      }
      return issue
    }))
  }

  // Stream Resume Improvement Rewrite
  const startImprovement = async () => {
    setResultsActiveTab('improved')
    setImproving(true)
    setImprovedResumeText('')

    try {
      const response = await fetch(`${API}/api/resume/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestions: improvementSuggestions })
      })

      if (!response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim())
              if (data.type === 'text') {
                setImprovedResumeText(prev => prev + data.content)
              }
              if (data.type === 'done') {
                setImproving(false)
                addToast('Improved resume created!', 'success')
              }
            } catch {
              // Ignore line parsing issues in buffer chunks
            }
          }
        }
      }
    } catch {
      setImproving(false)
      addToast('Improvement process failed.', 'error')
    }
  }

  // Download DOCX
  const downloadImprovedDocx = () => {
    window.open(`${API}/api/resume/improved/download`, '_blank')
    addToast('Downloading improved Word docx', 'success')
  }

  // Copy Improved Resume
  const copyImprovedResume = () => {
    navigator.clipboard.writeText(improvedResumeText)
    addToast('Improved resume copied to clipboard!', 'success')
  }

  // Chat submission with SSE streaming
  const handleChatSend = async (customMessage = null) => {
    const textToSend = customMessage || chatInput
    if (!textToSend.trim() || chatResponding) return

    const userMessage = { sender: 'user', text: textToSend }
    const updatedHistory = [...chatHistory, userMessage]
    
    setChatHistory(updatedHistory)
    setChatInput('')
    setChatResponding(true)

    // Add empty response placeholder
    const assistantMessagePlaceholder = { sender: 'gemini', text: '', searches: [] }
    setChatHistory(prev => [...prev, assistantMessagePlaceholder])

    try {
      const response = await fetch(`${API}/api/resume/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, history: chatHistory })
      })

      if (!response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let tempAssistantText = ''
      let tempSearches = []
      let activeQuery = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', '').trim())
              
              if (data.type === 'text') {
                tempAssistantText += data.content
              }
              if (data.type === 'search_start') {
                activeQuery = data.query
                tempSearches.push({ query: data.query, results: [] })
              }
              if (data.type === 'search_result') {
                tempSearches = tempSearches.map(s => {
                  if (s.query === activeQuery) {
                    return { ...s, results: [...s.results, { url: data.url, title: data.title }] }
                  }
                  return s
                })
              }

              // Update state reactively
              setChatHistory(prev => {
                const historyCopy = [...prev]
                const last = historyCopy[historyCopy.length - 1]
                last.text = tempAssistantText
                last.searches = tempSearches
                return historyCopy
              })

              if (data.type === 'done') {
                setChatResponding(false)
              }
            } catch {
              // Ignore line parse glitches
            }
          }
        }
      }
    } catch {
      setChatResponding(false)
      addToast('Chat message failed to send.', 'error')
    }
  }

  // Circular Score Gauge Color
  const getScoreColor = (val) => {
    if (val < 50) return 'var(--accent-red)'
    if (val < 75) return 'var(--accent-yellow)'
    return 'var(--accent-green)'
  }

  // Highlight exact quotes from resume
  const renderResumeWithHighlights = () => {
    if (!resumeText) return <div style={{ color: 'var(--text-muted)' }}>No resume loaded.</div>

    if (issues.length === 0) {
      return (
        <pre className="resume-pre-formatted">
          {resumeText}
        </pre>
      )
    }

    // Sort issues by index of their currentText quote
    const sortedQuotes = issues
      .filter(issue => issue.currentText && resumeText.toLowerCase().includes(issue.currentText.toLowerCase()))
      .map(issue => ({
        issue,
        quote: issue.currentText,
        index: resumeText.toLowerCase().indexOf(issue.currentText.toLowerCase()),
        length: issue.currentText.length
      }))
      .filter(q => q.index !== -1)
      .sort((a, b) => a.index - b.index)

    const elements = []
    let lastIndex = 0

    sortedQuotes.forEach((q, idx) => {
      if (q.index > lastIndex) {
        elements.push(resumeText.substring(lastIndex, q.index))
      }

      const isSelected = selectedIssueId === q.issue.id
      elements.push(
        <mark
          key={`highlight-${q.issue.id}-${idx}`}
          className={`resume-highlight ${q.issue.fixed ? 'highlight-green' : isSelected ? 'highlight-red-active' : 'highlight-red'}`}
          onClick={() => scrollToIssue(q.issue.id)}
          title={q.issue.problem}
        >
          {resumeText.substring(q.index, q.index + q.length)}
        </mark>
      )

      lastIndex = q.index + q.length
    })

    if (lastIndex < resumeText.length) {
      elements.push(resumeText.substring(lastIndex))
    }

    return (
      <pre className="resume-pre-formatted">
        {elements}
      </pre>
    )
  }

  // Fixed Issues Count
  const fixedCount = issues.filter(i => i.fixed).length

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Warning Banner */}
      {!hasApiKey && (
        <div className="warning-banner" style={{ background: 'rgba(255,180,0,0.1)', border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          ⚠️ Gemini API key not configured. Add it in <strong>Settings</strong> to use this feature.
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title gradient-text">🔍 Resume Analyzer</h1>
        {state !== 'upload' && (
          <button className="btn" onClick={() => { setState('upload'); setIssues([]) }}>
            🔄 Upload New Resume
          </button>
        )}
      </div>

      {/* ========================================================= */}
      {/* STATE 1: UPLOAD STATE                                     */}
      {/* ========================================================= */}
      {state === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 50 }}>
          <div className="upload-box" style={{ width: 400, height: 250, border: '2px dashed var(--border-color)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'var(--bg-secondary)', transition: '0.2s', position: 'relative' }}>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            />
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              {file ? file.name : 'Drop your resume PDF here'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {file ? 'Click to browse different file' : 'or click to browse'}
            </p>
          </div>

          {file && (
            <div style={{ marginTop: 15, display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="badge">PDF</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              <button className="btn btn-primary" onClick={uploadPdf} disabled={loading}>
                {loading ? 'Uploading...' : 'Confirm Upload'}
              </button>
            </div>
          )}

          <button 
            className="btn btn-primary btn-lg" 
            style={{ marginTop: 30, padding: '12px 36px' }}
            onClick={startAnalysis}
            disabled={!resumeText || loading}
          >
            {loading ? 'Processing...' : '🔍 Analyze My Resume'}
          </button>

          {isCustomUploaded && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--accent-green)' }}>
              ✓ Resume loaded ({wordCount} words). Ready to analyze.
            </p>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STATE 2: ANALYZING STATE                                  */}
      {/* ========================================================= */}
      {state === 'analyzing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: 20 }}>
          {/* Left Column */}
          <div>
            {/* Resume Preview */}
            <div className="card" style={{ height: 350, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: 'var(--text-secondary)' }}>
                📄 Resume Preview
              </div>
              <div className="resume-preview-box" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                {renderResumeWithHighlights()}
              </div>
            </div>

            {/* Web Search Activity Panel */}
            <div className="card" style={{ marginTop: 20, height: 250, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                🌐 Gemini is searching the web...
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {webSearches.map((search, idx) => (
                  <div key={idx} className="search-card" style={{ borderLeft: '3px solid var(--accent-blue)', background: 'var(--bg-tertiary)', padding: 8, borderRadius: 6, animation: 'slideIn 0.3s forwards' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        🔍 {search.query}
                      </span>
                      {search.done && <span style={{ color: 'var(--accent-green)', fontSize: 12 }}>✓</span>}
                    </div>
                    {search.results.map((res, ridx) => (
                      <div key={ridx} style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                        <a href={res.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                          {res.title}
                        </a>
                      </div>
                    ))}
                  </div>
                ))}
                {webSearches.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                    Waiting for web grounding queries...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="card" style={{ height: 620, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 14, fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 10 }}>
              📊 Live Analysis
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-secondary)' }}>
                {analysisText || 'Gathering insights and initializing resume scan...'}
              </pre>
              <div ref={analysisEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* STATE 3: RESULTS STATE                                    */}
      {/* ========================================================= */}
      {state === 'results' && (
        <div>
          {/* Top Score Summary Bar */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', marginBottom: 20, background: 'linear-gradient(to right, var(--bg-secondary), var(--bg-tertiary))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Circular SVG score gauge */}
              <div style={{ position: 'relative', width: 70, height: 70 }}>
                <svg width="70" height="70" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.91" fill="none" stroke="var(--border-color)" strokeWidth="2.5" />
                  <circle 
                    cx="18" 
                    cy="18" 
                    r="15.91" 
                    fill="none" 
                    stroke={getScoreColor(score)} 
                    strokeWidth="2.5"
                    strokeDasharray={`${score} 100`} 
                    style={{ transition: 'stroke-dasharray 1.5s ease-out-cubic' }}
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontWeight: 'bold', fontSize: 16 }}>
                  {score}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 'bold' }}>Overall Score</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed vs 2025 Industry Trends</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ATS Compatibility</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-blue)' }}>{scoreBreakdown.ats}/20</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quantified achievements</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-green)' }}>{scoreBreakdown.achievements}/20</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keywords & Skills</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{scoreBreakdown.keywords}/20</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Formatting & Clarity</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-orange)' }}>{scoreBreakdown.formatting}/20</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Career Narrative</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--accent-red)' }}>{scoreBreakdown.narrative}/20</div>
              </div>
            </div>
          </div>

          {/* 3-Panel Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '25% 45% 30%', gap: 20 }}>
            {/* Panel Left: Issue Navigator */}
            <div className="card" style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold' }}>⚠️ Issue Navigator</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {fixedCount} of {issues.length} critical issues addressed
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {issues.map(issue => (
                  <div 
                    key={issue.id} 
                    className={`issue-nav-item ${selectedIssueId === issue.id ? 'active' : ''}`}
                    onClick={() => scrollToIssue(issue.id)}
                    style={{
                      padding: 10, 
                      borderRadius: 6, 
                      border: '1px solid var(--border-color)',
                      background: selectedIssueId === issue.id ? 'var(--bg-tertiary)' : 'transparent',
                      cursor: 'pointer',
                      transition: '0.2s',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={issue.fixed} 
                      onChange={() => toggleIssueFixed(issue.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: issue.fixed ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
                        {issue.title}
                      </div>
                      <span className="badge" style={{ fontSize: 9, padding: '2px 4px', marginTop: 4, background: 'var(--bg-primary)' }}>
                        {issue.section}
                      </span>
                    </div>
                  </div>
                ))}
                {issues.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                    No critical issues extracted yet.
                  </div>
                )}
              </div>
            </div>

            {/* Panel Middle: Full Analysis Results */}
            <div className="card" style={{ height: 600, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 12 }}>
                🔧 Full Analysis & Action Plan
              </div>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10, paddingBottom: 80 }}>
                {issues.map(issue => (
                  <div 
                    key={issue.id}
                    ref={el => issueRefs.current[issue.id] = el}
                    style={{
                      border: `1px solid ${selectedIssueId === issue.id ? 'var(--accent-red)' : 'var(--border-color)'}`,
                      borderRadius: 8,
                      padding: 14,
                      marginBottom: 16,
                      background: 'rgba(255,0,0,0.02)',
                      transition: 'border 0.3s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ color: 'var(--accent-red)', fontSize: 13, fontWeight: 'bold' }}>
                        Issue {issue.id}: {issue.title}
                      </h4>
                      <span className="badge">{issue.section}</span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-secondary)' }}>
                      <strong>Problem:</strong> {issue.problem}
                    </div>
                    {issue.currentText && (
                      <div style={{ fontSize: 11, fontStyle: 'italic', background: 'var(--bg-primary)', padding: 8, borderRadius: 4, marginTop: 8, color: 'var(--text-muted)' }}>
                        "{issue.currentText}"
                      </div>
                    )}
                    {issue.whyItHurts && (
                      <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text-secondary)' }}>
                        <strong>Why it hurts you:</strong> {issue.whyItHurts}
                      </div>
                    )}
                    {issue.fix && (
                      <div style={{ borderLeft: '3px solid var(--accent-green)', background: 'rgba(0,255,0,0.02)', padding: 10, borderRadius: 4, marginTop: 10, fontSize: 12 }}>
                        <strong>Fix it like this:</strong> "{issue.fix}"
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sticky Improve Button */}
              <div style={{ position: 'absolute', bottom: 15, left: 15, right: 15, background: 'var(--bg-secondary)', padding: '10px 0', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input 
                    type="text" 
                    placeholder="Custom adjustments (e.g. Add Epic billing, highlight Orlando RCM)..."
                    value={improvementSuggestions}
                    onChange={(e) => setImprovementSuggestions(e.target.value)}
                    style={{ flex: 1, fontSize: 12 }}
                  />
                  <button className="btn btn-primary" onClick={startImprovement} disabled={improving}>
                    {improving ? 'Improving...' : '✨ Improve My Resume'}
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Right: Original + Improved Resume */}
            <div className="card" style={{ height: 600, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 12 }}>
                <button 
                  className={`tab-btn ${resultsActiveTab === 'original' ? 'active' : ''}`}
                  onClick={() => setResultsActiveTab('original')}
                  style={{ flex: 1, padding: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  Original Resume
                </button>
                <button 
                  className={`tab-btn ${resultsActiveTab === 'improved' ? 'active' : ''}`}
                  onClick={() => setResultsActiveTab('improved')}
                  style={{ flex: 1, padding: 10, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  ✨ Improved Resume
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {resultsActiveTab === 'original' ? (
                  <div className="resume-preview-box" style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)', height: '100%', overflowY: 'auto' }}>
                    {renderResumeWithHighlights()}
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                      <button className="btn btn-sm" onClick={copyImprovedResume} disabled={!improvedResumeText}>
                        📋 Copy Text
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={downloadImprovedDocx} disabled={!improvedResumeText}>
                        📄 Download .docx
                      </button>
                    </div>
                    <div className="resume-preview-box" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                      {improvedResumeText ? (
                        <pre className="resume-pre-formatted" style={{ whiteSpace: 'pre-wrap' }}>
                          {improvedResumeText}
                        </pre>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
                          {improving ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                              <span className="spinner" />
                              Gemini is rewriting your full resume...
                            </div>
                          ) : (
                            'Click "Improve My Resume" to generate an optimized version.'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MINI CHAT PANEL (Always Visible At Bottom)                */}
      {/* ========================================================= */}
      {state !== 'upload' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: '260px', // Matches Sidebar width
          right: 0,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          zIndex: 99,
          transition: 'all 0.3s ease'
        }}>
          {/* Header */}
          <div 
            onClick={() => setChatOpen(!chatOpen)}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '12px 24px', 
              cursor: 'pointer',
              background: 'var(--bg-tertiary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'bold' }}>
              <span>💬</span> Ask Gemini About Your Resume
            </div>
            <button style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {chatOpen ? '▼' : '▲'}
            </button>
          </div>

          {/* Collapsible Content */}
          {chatOpen && (
            <div style={{ height: 350, display: 'flex', flexDirection: 'column', padding: '16px 24px' }}>
              {/* Chat Message Box */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 15 }}>
                {chatHistory.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
                      Ask anything about your resume, market trends, or request adjustments.
                    </div>
                    {/* Suggested Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {[
                        "Why did you rate my achievements low?",
                        "What salary should I be targeting?",
                        "Which keywords am I missing for Epic roles?",
                        "How do I explain my gap since March 2024?",
                        "What would a recruiter think of my summary?"
                      ].map(chip => (
                        <button 
                          key={chip} 
                          className="chip" 
                          onClick={() => handleChatSend(chip)}
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 16,
                            padding: '6px 12px',
                            fontSize: 11,
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatHistory.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    {/* Embedded Grounding Search card */}
                    {msg.searches && msg.searches.length > 0 && (
                      <div style={{
                        maxWidth: '70%', 
                        background: 'rgba(0, 150, 255, 0.05)',
                        borderLeft: '2px solid var(--accent-blue)',
                        padding: 8, 
                        borderRadius: 6, 
                        fontSize: 11,
                        marginBottom: 4,
                        fontFamily: 'monospace'
                      }}>
                        🔍 Web ground queries: {msg.searches.map(s => s.query).join(', ')}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 8, maxWidth: '70%' }}>
                      {msg.sender === 'gemini' && (
                        <div style={{
                          width: 28, 
                          height: 28, 
                          borderRadius: '50%', 
                          background: 'var(--accent-purple)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 'bold',
                          fontSize: 11,
                          flexShrink: 0
                        }}>
                          G
                        </div>
                      )}
                      
                      <div style={{
                        background: msg.sender === 'user' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        padding: '10px 14px',
                        borderRadius: 12,
                        fontSize: 13,
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {msg.text || (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                            <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0s' }}>.</span>
                            <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }}>.</span>
                            <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }}>.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ display: 'flex', gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <input 
                  type="text" 
                  placeholder="Ask about your resume..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend() }}
                  disabled={chatResponding}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleChatSend()}
                  disabled={!chatInput.trim() || chatResponding}
                  style={{ padding: '8px 20px' }}
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
