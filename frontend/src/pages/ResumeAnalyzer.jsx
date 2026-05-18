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
  const [resumeDownloadName, setResumeDownloadName] = useState('Shilpa_Naik_Improved_Resume')

  // Chat States
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [chatResponding, setChatResponding] = useState(false)

  // Refs for scrolling and typewriter
  const analysisEndRef = useRef(null)
  const chatEndRef = useRef(null)
  const issueRefs = useRef({})

  // PDF Preview Timestamp (to bust browser iframe caching)
  const [pdfTimestamp, setPdfTimestamp] = useState(Date.now())

  // Dynamic layout enlarger for PDF preview panels
  const [isPdfEnlarged, setIsPdfEnlarged] = useState(false)

  // Claude-Style Web Search and Modal Menu States
  const [isChatWebSearchEnabled, setIsChatWebSearchEnabled] = useState(false)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState({})
  const [uploadedChatFile, setUploadedChatFile] = useState(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  
  // Thinking Mode States
  const [isChatThinkingEnabled, setIsChatThinkingEnabled] = useState(true) // On by default
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  // Fetch cached resume text on mount
  useEffect(() => {
    // Check if Mistral API key exists
    axios.get(`${API}/api/config`).then(r => {
      if (!r.data.mistral_api_key) {
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

  // Auto scroll to bottom of chat only when a new message is added (avoids aggressive scrolling while reading)
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory.length])

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
      setPdfTimestamp(Date.now()) // Refresh PDF preview iframe
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
      addToast('Mistral API key is not configured. Please add it in Settings first.', 'warning')
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
      
      if (data.type === 'error') {
        eventSource.close()
        setState('upload')
        addToast(data.message || 'API Error occurred', 'error')
        return
      }

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
              if (data.type === 'error') {
                setImproving(false)
                addToast(data.message || 'Improvement failed', 'error')
                return
              }
              if (data.type === 'text') {
                setImprovedResumeText(prev => prev + data.content)
              }
              if (data.type === 'done') {
                setImproving(false)
                setPdfTimestamp(Date.now()) // Refresh PDF preview iframe
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

  // Download PDF
  const downloadImprovedPdf = () => {
    const name = resumeDownloadName.trim() || 'Shilpa_Naik_Improved_Resume'
    window.open(`${API}/api/resume/improved/download?filename=${encodeURIComponent(name)}`, '_blank')
    addToast('Downloading improved PDF resume', 'success')
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

    // Capture file attachment details in the message bubble
    const attachedFile = uploadedChatFile ? { name: uploadedChatFile.name, type: uploadedChatFile.type, url: uploadedChatFile.contentUrl || null } : null
    const userMessage = { sender: 'user', text: textToSend, file: attachedFile }
    const updatedHistory = [...chatHistory, userMessage]
    
    setChatHistory(updatedHistory)
    setChatInput('')
    setUploadedChatFile(null) // Reset upload draft
    setChatResponding(true)

    // Add empty response placeholder
    const assistantMessagePlaceholder = { 
      sender: 'mistral', 
      text: '', 
      searches: [],
      thought: '',
      isThinking: isChatThinkingEnabled,
      thinkingTime: 0,
      thoughtExpanded: isChatThinkingEnabled 
    }
    setChatHistory(prev => [...prev, assistantMessagePlaceholder])

    // Build the final message text including visual file attachment info for Mistral
    let apiMessage = textToSend
    if (attachedFile) {
      apiMessage += `\n\n[Context: The user attached a screenshot/file named "${attachedFile.name}" for reference. Please acknowledge the attachment and help analyze it relative to their request.]`
    }

    // Thinking timer
    const timerInterval = isChatThinkingEnabled ? setInterval(() => {
      setChatHistory(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last && last.sender === 'mistral' && last.isThinking) {
          last.thinkingTime = (last.thinkingTime || 0) + 1
          return [...copy] // return new array ref to trigger render
        }
        return prev
      })
    }, 1000) : null;

    try {
      const response = await fetch(`${API}/api/resume/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: apiMessage, history: chatHistory, web_search: isChatWebSearchEnabled, thinking_mode: isChatThinkingEnabled })
      })

      if (!response.body) return
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      let tempAssistantText = ''
      let tempSearches = []
      let activeQuery = ''
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Save the last incomplete line to parse in the next chunk
        buffer = lines.pop() || ''

        for (const line of lines) {
          const cleanedLine = line.trim()
          if (cleanedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(cleanedLine.substring(6).trim())
              
              if (data.type === 'error') {
                setChatResponding(false)
                addToast(data.message || 'Chat failed', 'error')
                // Remove the empty assistant placeholder if it errored out
                setChatHistory(prev => prev.slice(0, -1))
                if (timerInterval) clearInterval(timerInterval)
                return
              }
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
                    const alreadyExists = s.results.some(r => r.url === data.url)
                    if (!alreadyExists) {
                      return { ...s, results: [...s.results, { url: data.url, title: data.title }] }
                    }
                  }
                  return s
                })
              }

              // Update state reactively
              setChatHistory(prev => {
                const historyCopy = [...prev]
                const last = historyCopy[historyCopy.length - 1]
                
                let displayText = tempAssistantText
                let thoughtText = last.thought || ''
                let isThinking = last.isThinking
                let expanded = last.thoughtExpanded

                const thoughtMatch = tempAssistantText.match(/<thought>([\s\S]*?)<\/thought>/);
                if (thoughtMatch) {
                  // Thinking finished
                  thoughtText = thoughtMatch[1].trim()
                  displayText = tempAssistantText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim()
                  if (isThinking) {
                    isThinking = false
                    expanded = false // Auto-close when done thinking
                  }
                } else if (tempAssistantText.includes('<thought>')) {
                  // Currently thinking
                  thoughtText = tempAssistantText.split('<thought>')[1] || ''
                  displayText = ''
                  isThinking = true
                } else if (isChatThinkingEnabled) {
                  // The stream started but <thought> hasn't arrived yet
                  isThinking = true
                }
                
                last.text = displayText
                last.thought = thoughtText
                last.isThinking = isThinking
                last.thoughtExpanded = expanded
                last.searches = tempSearches
                return historyCopy
              })

              if (data.type === 'done') {
                setChatResponding(false)
              }
            } catch (err) {
              console.error('Failed to parse SSE line:', cleanedLine, err)
            }
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err)
      addToast('An error occurred during chat.', 'error')
      setChatResponding(false)
    } finally {
      if (timerInterval) clearInterval(timerInterval)
    }
  }

  // Toggle Claude-style search results citations expansion
  const toggleSearchExpanded = (idx) => {
    setSearchExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  // Handle uploaded files/screenshots in the chat panel
  const handleChatFileAttach = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setUploadedChatFile({
        name: file.name,
        type: file.type,
        size: file.size,
        base64: reader.result,
        contentUrl: file.type.startsWith('image/') ? reader.result : null
      })
      addToast(`Attached file: ${file.name}`, 'success')
    }
    reader.readAsDataURL(file)
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
          ⚠️ Mistral API key not configured. Add it in <strong>Settings</strong> to use this feature.
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
        <div style={{ display: 'grid', gridTemplateColumns: isPdfEnlarged ? '60% 40%' : '45% 55%', gap: 20, transition: 'all 0.3s ease' }}>
          {/* Left Column */}
          <div>
            {/* Resume Preview */}
            <div className="card" style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  📄 Original Resume PDF Preview
                </div>
                <button 
                  className="btn btn-sm"
                  onClick={() => setIsPdfEnlarged(!isPdfEnlarged)}
                  style={{ padding: '4px 10px', fontSize: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                >
                  {isPdfEnlarged ? '🔍 Shrink' : '🔍 Enlarge PDF'}
                </button>
              </div>
              <div className="resume-preview-box" style={{ flex: 1, background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <iframe 
                  src={`${API}/api/resume/original/pdf?t=${pdfTimestamp}`}
                  width="100%" 
                  height="100%" 
                  style={{ border: 'none' }} 
                  title="Original Resume PDF Preview"
                />
              </div>
            </div>

            {/* Web Search Activity Panel */}
            <div className="card" style={{ marginTop: 20, height: 250, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                🌐 Mistral is searching the web...
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
          <div style={{ display: 'grid', gridTemplateColumns: isPdfEnlarged ? '15% 30% 55%' : '25% 45% 30%', gap: 20, transition: 'all 0.3s ease' }}>
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
            <div className="card" style={{ height: 750, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flex: 1 }}>
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
                <button 
                  className="btn btn-sm"
                  onClick={() => setIsPdfEnlarged(!isPdfEnlarged)}
                  style={{ marginLeft: 12, marginRight: 12, padding: '4px 12px', fontSize: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                >
                  {isPdfEnlarged ? '🔍 Shrink View' : '🔍 Enlarge PDF'}
                </button>
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {resultsActiveTab === 'original' ? (
                  <div className="resume-preview-box" style={{ background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', height: '100%', overflow: 'hidden' }}>
                    <iframe 
                      src={`${API}/api/resume/original/pdf?t=${pdfTimestamp}`}
                      width="100%" 
                      height="100%" 
                      style={{ border: 'none' }} 
                      title="Original Resume PDF"
                    />
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                      <button className="btn btn-sm" onClick={copyImprovedResume} disabled={!improvedResumeText}>
                        📋 Copy Text
                      </button>
                      <input
                        type="text"
                        value={resumeDownloadName}
                        onChange={(e) => setResumeDownloadName(e.target.value)}
                        placeholder="Resume file name"
                        disabled={!improvedResumeText}
                        style={{ flex: 1, minWidth: 0, fontSize: 12 }}
                      />
                      <button className="btn btn-sm btn-primary" onClick={downloadImprovedPdf} disabled={!improvedResumeText}>
                        📄 Download .pdf
                      </button>
                    </div>
                    <div className="resume-preview-box" style={{ flex: 1, background: '#fff', borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {improvedResumeText ? (
                        <iframe 
                          src={`${API}/api/resume/improved/pdf?t=${pdfTimestamp}`}
                          width="100%" 
                          height="100%" 
                          style={{ border: 'none', flex: 1 }} 
                          title="Improved Resume PDF"
                        />
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 40, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                          {improving ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                              <span className="spinner" />
                              Mistral is rewriting your full resume...
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
      {/* CLAUDE-STYLE FLOATING ACTION BUTTON AND CENTERED MODAL   */}
      {/* ========================================================= */}
      {state !== 'upload' && (
        <>
          {/* Floating Action Button (FAB) */}
          <button 
            onClick={() => setChatOpen(true)}
            style={{
              position: 'fixed',
              bottom: 25,
              right: 25,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 26px',
              background: 'var(--accent-purple)',
              color: '#fff',
              border: 'none',
              borderRadius: 30,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 'bold',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 1000
            }}
            className="chat-fab-btn"
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = '0 12px 40px rgba(139, 92, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
            }}
          >
            <span style={{ fontSize: 16 }}>💬</span> Ask Mistral
            {isChatWebSearchEnabled && (
              <span style={{
                fontSize: 9,
                background: 'rgba(59, 130, 246, 0.25)',
                color: 'var(--accent-blue)',
                padding: '2px 6px',
                borderRadius: 10,
                border: '1px solid rgba(59, 130, 246, 0.4)',
                marginLeft: 4
              }}>
                Search ON
              </span>
            )}
          </button>

          {/* Glassmorphic Centered Chat Modal */}
          {chatOpen && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                animation: 'fadeIn 0.2s ease-out'
              }}
              onClick={() => {
                setChatOpen(false)
                setPlusMenuOpen(false)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDraggingFile(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                setIsDraggingFile(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDraggingFile(false)
                const file = e.dataTransfer.files[0]
                if (file) handleChatFileAttach(file)
              }}
            >
              {/* Modal Box */}
              <div 
                style={{
                  width: '900px',
                  height: '680px',
                  maxWidth: '92%',
                  maxHeight: '85vh',
                  background: 'var(--bg-secondary)',
                  borderRadius: 16,
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Hidden File Input for click triggered uploading */}
                <input 
                  type="file" 
                  id="chat-file-input" 
                  accept="image/*,application/pdf,text/plain"
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file) handleChatFileAttach(file)
                    e.target.value = ''
                  }}
                />

                {/* Drag-and-Drop Overlay drop zone */}
                {isDraggingFile && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(139, 92, 246, 0.25)',
                    border: '3px dashed var(--accent-purple)',
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-purple)',
                    zIndex: 99999,
                    pointerEvents: 'none',
                    animation: 'scaleUp 0.15s ease-out'
                  }}>
                    <span style={{ fontSize: 44, marginBottom: 12 }}>📥</span>
                    <span style={{ fontSize: 16, fontWeight: 'bold' }}>Drop your Screenshot or File here!</span>
                  </div>
                )}

                {/* Modal Header */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 24px', 
                    background: 'var(--bg-tertiary)',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>💬</span> 
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        Mistral Assistant
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Interactive career coaching, resume adjustments & web search grounding
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setChatOpen(false)
                      setPlusMenuOpen(false)
                    }}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontSize: 18, 
                      cursor: 'pointer', 
                      color: 'var(--text-secondary)',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Chat Scrollable Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {chatHistory.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 600, margin: '0 auto' }}>
                      <div style={{ fontSize: 24, marginBottom: 12 }}>🤖</div>
                      <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 'bold', marginBottom: 8 }}>
                        Ask Mistral about your Resume
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
                        Ask questions about market trends, missing keywords, salary projections, or draft bullet rewrites with real-time web-grounded research.
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
                            onClick={() => handleChatSend(chip)}
                            style={{
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 20,
                              padding: '8px 16px',
                              fontSize: 11,
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              transition: '0.2s'
                            }}
                            className="chip-btn"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatHistory.map((msg, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                      {/* Claude-style Web Search Accordion */}
                      {msg.searches && msg.searches.length > 0 && (
                        <div style={{
                          width: '100%',
                          maxWidth: '85%',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 10,
                          padding: '16px',
                          marginBottom: 12,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                          animation: 'fadeIn 0.25s ease-out'
                        }}>
                          {/* Search Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            {msg.text ? (
                              <span style={{ color: 'var(--accent-green)', fontWeight: '600', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>✓</span> Web grounding complete
                              </span>
                            ) : (
                              <span style={{ color: 'var(--accent-blue)', fontWeight: '600', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="spinner" style={{ width: 14, height: 14, borderLeftColor: 'var(--accent-blue)', display: 'inline-block', animation: 'spinner 1s linear infinite' }} />
                                Mistral is searching the web...
                              </span>
                            )}
                          </div>

                          {/* Live Searching Details List (Always Visible) */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                            {msg.searches.map((s, sIdx) => (
                              <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: '500' }}>
                                  🔍 Query: "{s.query}"
                                </div>
                                
                                {/* Found Websites List - Rendered live one by one */}
                                {s.results && s.results.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12 }}>
                                    {s.results.map((res, rIdx) => {
                                      let hostname = 'website'
                                      try {
                                        hostname = new URL(res.url).hostname.replace('www.', '')
                                      } catch {}
                                      return (
                                        <div 
                                          key={rIdx} 
                                          style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 8, 
                                            fontSize: 11, 
                                            color: 'var(--text-muted)',
                                            animation: 'scaleUp 0.2s ease-out'
                                          }}
                                        >
                                          <span style={{ color: 'var(--accent-green)' }}>✓</span>
                                          <span>Looked at:</span>
                                          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{hostname}</span>
                                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            ({res.title})
                                          </span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span className="spinner" style={{ width: 10, height: 10, borderLeftColor: 'var(--text-muted)', display: 'inline-block', animation: 'spinner 1s linear infinite' }} />
                                    Locating relevant websites...
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Horizontal Citation Cards Grid - Visible once found */}
                          {msg.searches.some(s => s.results && s.results.length > 0) && (
                            <div style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                              <div style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                                References:
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                                {msg.searches.flatMap(s => s.results || []).map((res, rIdx) => {
                                  let hostname = 'website'
                                  try {
                                    hostname = new URL(res.url).hostname.replace('www.', '')
                                  } catch {}
                                  return (
                                    <a 
                                      key={rIdx} 
                                      href={res.url} 
                                      target="_blank" 
                                      rel="noreferrer" 
                                      style={{
                                        display: 'block',
                                        padding: '8px 12px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 8,
                                        textDecoration: 'none',
                                        transition: 'all 0.2s ease',
                                        overflow: 'hidden'
                                      }}
                                      className="search-citation-card"
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)'
                                        e.currentTarget.style.borderColor = 'var(--accent-blue)'
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)'
                                        e.currentTarget.style.borderColor = 'var(--border-color)'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 14 }}>🌐</span>
                                        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                          {hostname}
                                        </span>
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-primary)', marginTop: 4, fontWeight: '500', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                        {res.title}
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Attached File/Screenshot bubble preview inside thread */}
                      {msg.file && (
                        <div style={{ marginBottom: 6, display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                          {msg.file.url ? (
                            <img 
                              src={msg.file.url} 
                              alt="Screenshot/File upload" 
                              style={{ maxWidth: 220, maxHeight: 160, borderRadius: 10, border: '1px solid var(--border-color)', objectFit: 'cover', display: 'block', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} 
                            />
                          ) : (
                            <div style={{
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 12,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                              <span>📄</span>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{msg.file.name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, maxWidth: '85%' }}>
                        {msg.sender === 'mistral' && (
                          <div style={{
                            width: 32, 
                            height: 32, 
                            borderRadius: '50%', 
                            background: 'var(--accent-purple)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: 12,
                            flexShrink: 0
                          }}>
                            M
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, maxWidth: '100%' }}>
                          {msg.sender === 'mistral' && (msg.thought || msg.isThinking) && (
                            <div style={{ 
                              background: 'var(--bg-primary)', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: 8,
                              overflow: 'hidden',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                            }}>
                              <div 
                                style={{ 
                                  padding: '8px 12px', 
                                  fontSize: 12, 
                                  color: 'var(--text-secondary)',
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 8,
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                                onClick={() => {
                                  setChatHistory(prev => {
                                    const copy = [...prev]
                                    if (copy[idx]) {
                                      copy[idx].thoughtExpanded = !copy[idx].thoughtExpanded
                                    }
                                    return copy
                                  })
                                }}
                              >
                                {msg.isThinking ? (
                                  <>
                                    <span style={{ fontWeight: 500 }}>Thinking...</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{msg.thinkingTime || 0}s</span>
                                    <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginLeft: 4 }}>
                                      <span className="dot" style={{ width: 4, height: 4, background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite both', animationDelay: '0s' }} />
                                      <span className="dot" style={{ width: 4, height: 4, background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }} />
                                      <span className="dot" style={{ width: 4, height: 4, background: 'var(--text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }} />
                                    </div>
                                  </>
                                ) : (
                                  <span style={{ fontWeight: 500 }}>Thought for {msg.thinkingTime || 0}s</span>
                                )}
                                <span style={{ transform: msg.thoughtExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.2s', fontSize: 10 }}>▶</span>
                              </div>
                              {msg.thoughtExpanded && msg.thought && (
                                <div style={{ 
                                  padding: '12px', 
                                  borderTop: '1px solid var(--border-color)', 
                                  fontSize: 12, 
                                  color: 'var(--text-muted)', 
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                  background: 'var(--bg-tertiary)',
                                  fontFamily: 'monospace'
                                }}>
                                  {msg.thought}
                                </div>
                              )}
                            </div>
                          )}

                          {!(msg.sender === 'mistral' && msg.isThinking && !msg.text) && (
                            <div style={{
                              background: msg.sender === 'user' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                              color: 'var(--text-primary)',
                              padding: '12px 16px',
                              borderRadius: 14,
                              fontSize: 13,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                              border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)'
                            }}>
                              {msg.text || (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                                  <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0s' }}>.</span>
                                  <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.2s' }}>.</span>
                                  <span className="dot" style={{ animation: 'bounce 1.4s infinite both', animationDelay: '0.4s' }}>.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Claude-style Input Block */}
                <div 
                  style={{ 
                    padding: '16px 24px', 
                    borderTop: '1px solid var(--border-color)', 
                    background: 'var(--bg-tertiary)',
                    position: 'relative'
                  }}
                >
                  {/* Plus Trigger Popup Menu */}
                  {plusMenuOpen && (
                    <div 
                      style={{
                        position: 'absolute',
                        bottom: '75px',
                        left: '24px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        padding: '6px 0',
                        zIndex: 101,
                        width: '210px',
                        animation: 'scaleUp 0.15s ease-out'
                      }}
                    >
                      {/* Toggle Web Search option */}
                      <div 
                        onClick={() => {
                          setIsChatWebSearchEnabled(!isChatWebSearchEnabled)
                          setPlusMenuOpen(false)
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          transition: '0.2s'
                        }}
                        className="menu-item"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>🌐</span>
                          <strong>Web search</strong>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={isChatWebSearchEnabled} 
                          onChange={() => {}} 
                          style={{ pointerEvents: 'none' }}
                        />
                      </div>
                      
                      {/* Active Upload Files / Screenshots button option */}
                      <div 
                        onClick={() => {
                          document.getElementById('chat-file-input').click()
                          setPlusMenuOpen(false)
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          color: 'var(--text-primary)',
                          transition: '0.2s'
                        }}
                        className="menu-item"
                      >
                        <span>📎</span>
                        <strong>Add files or photos</strong>
                      </div>
                    </div>
                  )}

                  {/* Claude Rounded Input Field Container */}
                  <div 
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    {/* Active Uploaded File preview box inside Draft field */}
                    {uploadedChatFile && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'var(--bg-tertiary)',
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        alignSelf: 'flex-start',
                        marginBottom: 4,
                        animation: 'scaleUp 0.15s ease-out'
                      }}>
                        {uploadedChatFile.contentUrl ? (
                          <img 
                            src={uploadedChatFile.contentUrl} 
                            alt="Attachment Draft" 
                            style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} 
                          />
                        ) : (
                          <span style={{ fontSize: 16 }}>📄</span>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: '500', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {uploadedChatFile.name}
                          </span>
                          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            {(uploadedChatFile.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button 
                          onClick={() => setUploadedChatFile(null)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: 12,
                            marginLeft: 8,
                            padding: '0 2px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* Main Input Text Field */}
                    <input 
                      type="text" 
                      placeholder="Ask Mistral about your resume..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleChatSend() }}
                      disabled={chatResponding}
                      style={{ 
                        flex: 1, 
                        fontSize: 13, 
                        border: 'none', 
                        background: 'none', 
                        outline: 'none',
                        color: 'var(--text-primary)',
                        padding: '4px 0'
                      }}
                    />

                    {/* Footer Row inside Input Box */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Plus Button */}
                        <button
                          onClick={() => setPlusMenuOpen(!plusMenuOpen)}
                          disabled={chatResponding}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold'
                          }}
                        >
                          +
                        </button>
                        
                        {/* Web search active capsule tag with active mini close button */}
                        {isChatWebSearchEnabled && (
                          <div 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: 'rgba(59, 130, 246, 0.12)',
                              color: 'var(--accent-blue)',
                              padding: '3px 10px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: '500',
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}
                          >
                            <span>🌐 Web Search Active</span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation()
                                setIsChatWebSearchEnabled(false)
                              }}
                              style={{
                                marginLeft: 4,
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: 11,
                                opacity: 0.8,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Disable Web Search"
                              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = 0.8}
                            >
                              ✕
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Right Side: Model Selector + Send Button */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                        {/* Claude-style Model Selector Button */}
                        <div 
                          onClick={() => setModelMenuOpen(!modelMenuOpen)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            transition: '0.2s',
                            userSelect: 'none'
                          }}
                          className="model-selector-btn"
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 600 }}>Mistral Large</span>
                          <span style={{ fontSize: 9 }}>▼</span>
                        </div>
                        
                        {/* Claude-style Model Selector Dropdown Popover */}
                        {modelMenuOpen && (
                          <div 
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 12px)',
                              right: 0,
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 12,
                              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                              padding: '8px',
                              zIndex: 102,
                              width: '260px',
                              animation: 'scaleUp 0.15s ease-out'
                            }}
                          >
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 13, fontWeight: '600', color: 'var(--text-primary)' }}>Mistral Large</span>
                                <span style={{ color: 'var(--accent-blue)', fontSize: 14 }}>✓</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                Powerful reasoning for complex tasks
                              </div>
                            </div>
                            
                            <div 
                              onClick={() => {
                                setIsChatThinkingEnabled(!isChatThinkingEnabled)
                              }}
                              style={{
                                cursor: 'pointer',
                                padding: '10px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderRadius: 8,
                                transition: '0.2s'
                              }}
                              className="menu-item"
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: '500', color: 'var(--text-primary)' }}>Thinking</span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Thinks for more complex tasks</span>
                              </div>
                              
                              {/* Toggle Switch */}
                              <div style={{
                                width: 34,
                                height: 20,
                                background: isChatThinkingEnabled ? 'var(--accent-blue)' : 'var(--border-color)',
                                borderRadius: 10,
                                position: 'relative',
                                transition: '0.2s'
                              }}>
                                <div style={{
                                  position: 'absolute',
                                  top: 2,
                                  left: isChatThinkingEnabled ? 16 : 2,
                                  width: 16,
                                  height: 16,
                                  background: '#fff',
                                  borderRadius: '50%',
                                  transition: '0.2s',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }} />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Send Button */}
                        <button 
                          onClick={() => {
                            setModelMenuOpen(false)
                            handleChatSend()
                          }}
                          disabled={!chatInput.trim() || chatResponding}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: chatInput.trim() && !chatResponding ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
                            color: '#fff',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: chatInput.trim() && !chatResponding ? 'pointer' : 'default',
                            fontSize: 13,
                            transition: '0.2s'
                          }}
                        >
                          ➔
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
