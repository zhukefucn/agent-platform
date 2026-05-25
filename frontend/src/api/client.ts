import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'

const API_BASE = '/api/v1'

// Types
export interface User {
  id: string
  email: string
  username: string
  role: string
  tenant_id: string
}

export interface Agent {
  id: string
  name: string
  description: string
  model: string
  system_prompt: string
  temperature: number
  max_tokens: number
  is_active: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tokens_used: number
  model: string
}

export interface Session {
  id: string
  title: string
  agent_id: string
  is_active: boolean
  created_at: string
}

export interface UsageStats {
  tenant_id: string
  total_tokens: number
  prompt_tokens: number
  completion_tokens: number
  total_calls: number
  token_limit: number
  usage_percent: number
  by_model: { model: string; tokens: number; calls: number }[]
}

// Auth Context
interface AuthContextType {
  token: string | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (token) {
      fetchUser()
    }
  }, [token])

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
      } else {
        logout()
      }
    } catch { logout() }
  }

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Login failed')
    }
    const data = await res.json()
    setToken(data.access_token)
    localStorage.setItem('token', data.access_token)
    setUser({ id: data.user_id, email, username: email.split('@')[0], role: data.role, tenant_id: data.tenant_id })
  }

  const register = async (email: string, username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.detail || 'Register failed')
    }
    const data = await res.json()
    setToken(data.access_token)
    localStorage.setItem('token', data.access_token)
    setUser({ id: data.user_id, email, username, role: data.role, tenant_id: data.tenant_id })
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// API functions
export async function fetchAgents(token: string): Promise<Agent[]> {
  const res = await fetch(`${API_BASE}/tenants/agents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch agents')
  return res.json()
}

export async function fetchSessions(token: string): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/agents/sessions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export async function sendChat(token: string, agentId: string, message: string, sessionId?: string) {
  const res = await fetch(`${API_BASE}/agents/chat`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ agent_id: agentId, message, session_id: sessionId })
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || 'Chat failed')
  }
  return res.json()
}

export async function fetchUsageStats(token: string): Promise<UsageStats> {
  const res = await fetch(`${API_BASE}/usage/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}