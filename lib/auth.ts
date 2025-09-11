'use client'

const AUTH_SESSION_KEY = 'aivida_auth_session'
const SESSION_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds

export interface AuthSession {
  isAuthenticated: boolean
  timestamp: number
}

export function setAuthSession(): void {
  const session: AuthSession = {
    isAuthenticated: true,
    timestamp: Date.now()
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(AUTH_SESSION_KEY)
    if (!stored) return null
    
    const session: AuthSession = JSON.parse(stored)
    
    // Check if session is expired
    const now = Date.now()
    if (now - session.timestamp > SESSION_DURATION) {
      clearAuthSession()
      return null
    }
    
    return session
  } catch (error) {
    console.error('Error parsing auth session:', error)
    clearAuthSession()
    return null
  }
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_SESSION_KEY)
}

export function isAuthenticated(): boolean {
  const session = getAuthSession()
  return session?.isAuthenticated === true
}

export function checkAuthAndRedirect(): boolean {
  if (typeof window === 'undefined') return false
  
  if (!isAuthenticated()) {
    window.location.href = '/login'
    return false
  }
  
  return true
}
