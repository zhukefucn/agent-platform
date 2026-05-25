import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, fetchAgents, fetchSessions, sendChat, fetchUsageStats, Agent, Session, UsageStats } from '../api/client'

export default function Chat() {
  const { user, logout, token } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState<Agent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const messagesEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) {
      navigate('/')
      return
    }
    loadData()
  }, [token])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadData = async () => {
    try {
      const [agentsData, sessionsData, statsData] = await Promise.all([
        fetchAgents(token!),
        fetchSessions(token!),
        fetchUsageStats(token!)
      ])
      setAgents(agentsData)
      setSessions(sessionsData)
      setStats(statsData)
      if (agentsData.length > 0) {
        setSelectedAgent(agentsData[0])
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || loading) return
    
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await sendChat(token!, selectedAgent.id, userMsg, selectedSession || undefined)
      setMessages(prev => [
        ...prev,
        { role: 'user', content: userMsg },
        { role: 'assistant', content: res.messages[1].content }
      ])
      setSelectedSession(res.session_id)
      // Refresh sessions
      const sessionsData = await fetchSessions(token!)
      setSessions(sessionsData)
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `错误: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const startNewChat = () => {
    setSelectedSession(null)
    setMessages([])
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-800">智能体中台</h1>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600">{user?.username}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            用量统计
          </button>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700"
          >
            退出
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={startNewChat}
              className="w-full py-2 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium"
            >
              + 新建对话
            </button>
          </div>
          
          {/* Agent Selector */}
          <div className="p-4 border-b border-gray-200">
            <label className="text-xs text-gray-500 uppercase">选择 Agent</label>
            <select
              value={selectedAgent?.id || ''}
              onChange={e => {
                const agent = agents.find(a => a.id === e.target.value)
                setSelectedAgent(agent || null)
              }}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            {selectedAgent && (
              <p className="mt-2 text-xs text-gray-500">{selectedAgent.description || selectedAgent.model}</p>
            )}
          </div>

          {/* Sessions */}
          <div className="flex-1 overflow-y-auto p-2">
            <label className="text-xs text-gray-500 uppercase px-2">历史会话</label>
            <div className="mt-2 space-y-1">
              {sessions.slice(0, 10).map(session => (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session.id)
                    setMessages([])
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate ${
                    selectedSession === session.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-gray-50'
                  }`}
                >
                  {session.title}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                <p className="text-lg">开始与 {selectedAgent?.name || 'Agent'} 对话</p>
                <p className="text-sm mt-2">发送消息开始对话</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-2xl px-4 py-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-brand-600 text-white' 
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                rows={1}
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </div>
        </main>

        {/* Stats Panel */}
        {showStats && stats && (
          <aside className="w-72 bg-white border-l border-gray-200 p-4 overflow-y-auto">
            <h3 className="font-bold text-gray-800 mb-4">用量统计</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-brand-600">{stats.total_tokens.toLocaleString()}</div>
                <div className="text-sm text-gray-500">已用 Token</div>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-500" 
                    style={{ width: `${Math.min(stats.usage_percent, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{stats.usage_percent}% / {stats.token_limit.toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800">{stats.total_calls}</div>
                  <div className="text-xs text-gray-500">对话次数</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-gray-800">{stats.by_model.length}</div>
                  <div className="text-xs text-gray-500">使用模型</div>
                </div>
              </div>
              {stats.by_model.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">按模型</div>
                  {stats.by_model.map(item => (
                    <div key={item.model} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.model}</span>
                      <span className="text-gray-800">{item.tokens.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}