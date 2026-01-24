'use client'

import { signOut } from 'next-auth/react'
import { useAdmin } from '@/contexts/AdminContext'
import { CachedAthleteInfo } from '@/lib/admin'

interface HeaderProps {
  userName?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function AthleteSelector({ athletes }: { athletes: CachedAthleteInfo[] }) {
  const { selectedAthleteId, setSelectedAthleteId, ownAthleteId } = useAdmin()

  if (athletes.length === 0) {
    return (
      <span className="text-sm text-stone-400 italic">
        No cached athletes
      </span>
    )
  }

  return (
    <select
      value={selectedAthleteId || ''}
      onChange={(e) => setSelectedAthleteId(e.target.value || null)}
      className="px-3 py-1.5 bg-stone-700 text-white text-sm rounded border border-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
    >
      {athletes.map((athlete) => (
        <option key={athlete.athleteId} value={athlete.athleteId}>
          Athlete {athlete.athleteId}
          {athlete.athleteId === ownAthleteId ? ' (You)' : ''}
          {' · '}
          {athlete.activityCount} activities
          {athlete.oldestActivity && athlete.newestActivity && (
            <> · {formatDate(athlete.oldestActivity)} - {formatDate(athlete.newestActivity)}</>
          )}
        </option>
      ))}
    </select>
  )
}

export default function Header({ userName }: HeaderProps) {
  const {
    adminMode,
    setAdminMode,
    isAdmin,
    availableAthletes,
    selectedAthleteId,
    ownAthleteId
  } = useAdmin()

  const isViewingOtherUser = adminMode && selectedAthleteId && selectedAthleteId !== ownAthleteId

  return (
    <header className="sticky top-0 z-50 bg-stone-800 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo / App name */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            Strava Book
          </h1>
          {isViewingOtherUser && (
            <span className="px-2 py-0.5 bg-orange-600 text-white text-xs font-semibold rounded">
              Viewing: {selectedAthleteId}
            </span>
          )}
        </div>

        {/* Right side: Admin toggle + User info */}
        <div className="flex items-center gap-4">
          {/* Admin mode toggle (only visible to admins) */}
          {isAdmin && (
            <div className="flex items-center gap-3">
              {adminMode && (
                <AthleteSelector athletes={availableAthletes} />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-stone-300">Admin</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={adminMode}
                    onChange={(e) => setAdminMode(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-stone-600 rounded-full peer peer-checked:bg-orange-600 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
              </label>
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 pl-4 border-l border-stone-600">
            <span className="text-sm text-stone-300">
              {userName || 'Athlete'}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm text-stone-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
