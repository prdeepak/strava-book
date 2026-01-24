'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { CachedAthleteInfo } from '@/lib/admin'

interface AdminContextValue {
  // Whether admin mode is currently active
  adminMode: boolean
  setAdminMode: (enabled: boolean) => void

  // The athlete ID being viewed (own ID when not in admin mode, selected ID in admin mode)
  selectedAthleteId: string | null
  setSelectedAthleteId: (id: string | null) => void

  // Available athletes for selection (admin only)
  availableAthletes: CachedAthleteInfo[]
  setAvailableAthletes: (athletes: CachedAthleteInfo[]) => void

  // Whether the current user is an admin
  isAdmin: boolean
  setIsAdmin: (isAdmin: boolean) => void

  // The logged-in user's own athlete ID
  ownAthleteId: string | null
  setOwnAthleteId: (id: string | null) => void
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined)

const STORAGE_KEY = 'strava-book-admin-state'

interface StoredAdminState {
  adminMode: boolean
  selectedAthleteId: string | null
}

export function AdminProvider({ children }: { children: ReactNode }) {
  // Initialize state with default values (client-side hydration will update)
  const [adminMode, setAdminModeState] = useState(false)
  const [selectedAthleteId, setSelectedAthleteIdState] = useState<string | null>(null)
  const [availableAthletes, setAvailableAthletes] = useState<CachedAthleteInfo[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [ownAthleteId, setOwnAthleteIdState] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Load state from localStorage on mount (client-side only)
  // This is a legitimate pattern for hydrating state from external storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const state: StoredAdminState = JSON.parse(stored)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAdminModeState(state.adminMode)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedAthleteIdState(state.selectedAthleteId)
      }
    } catch {
      // Ignore localStorage errors
    }
    setInitialized(true)
  }, [])

  // Persist state to localStorage when it changes
  useEffect(() => {
    if (!initialized) return
    try {
      const state: StoredAdminState = { adminMode, selectedAthleteId }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore localStorage errors
    }
  }, [adminMode, selectedAthleteId, initialized])

  // Wrapper to also handle resetting selected athlete when admin mode is toggled off
  const setAdminMode = (enabled: boolean) => {
    setAdminModeState(enabled)
    if (!enabled) {
      // When exiting admin mode, reset to own athlete
      setSelectedAthleteIdState(ownAthleteId)
    }
  }

  const setSelectedAthleteId = (id: string | null) => {
    setSelectedAthleteIdState(id)
  }

  const setOwnAthleteId = (id: string | null) => {
    setOwnAthleteIdState(id)
  }

  return (
    <AdminContext.Provider
      value={{
        adminMode,
        setAdminMode,
        selectedAthleteId,
        setSelectedAthleteId,
        availableAthletes,
        setAvailableAthletes,
        isAdmin,
        setIsAdmin,
        ownAthleteId,
        setOwnAthleteId
      }}
    >
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
