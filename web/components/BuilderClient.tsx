'use client'

import { useState, useEffect } from 'react'
import { StravaActivity } from '@/lib/strava'
import { CachedAthleteInfo } from '@/lib/admin'
import PDFGenerationModal from '@/components/PDFGenerationModal'
import ManualBookGenerationModal from '@/components/ManualBookGenerationModal'
import PeriodPDFGenerationModal from '@/components/PeriodPDFGenerationModal'
import Header from '@/components/Header'
import { useAdmin } from '@/contexts/AdminContext'

interface BuilderClientProps {
    initialActivities: StravaActivity[]
    accessToken: string
    athleteName: string
    athleteId: string
    isAdmin: boolean
    availableAthletes: CachedAthleteInfo[]
    stravaError?: boolean
    cachedCount?: number
}

// Workout type mapping based on Strava API
const WORKOUT_TYPES: Record<number, string> = {
    0: 'Default',
    1: 'Race',
    2: 'Long Run',
    3: 'Workout'
}

export default function BuilderClient({
    initialActivities,
    athleteName,
    athleteId,
    isAdmin: isAdminProp,
    availableAthletes: availableAthletesProp,
    stravaError,
    cachedCount
}: BuilderClientProps) {
    // Admin context
    const {
        adminMode,
        selectedAthleteId,
        setSelectedAthleteId,
        setIsAdmin,
        setOwnAthleteId,
        setAvailableAthletes
    } = useAdmin()

    // Initialize admin context from props
    useEffect(() => {
        setIsAdmin(isAdminProp)
        setOwnAthleteId(athleteId)
        setAvailableAthletes(availableAthletesProp)
        // Set initial selected athlete to self if not already set
        if (!selectedAthleteId) {
            setSelectedAthleteId(athleteId)
        }
    }, [isAdminProp, athleteId, availableAthletesProp, setIsAdmin, setOwnAthleteId, setAvailableAthletes, setSelectedAthleteId, selectedAthleteId])

    // Calculate default date range
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed (0 = January, 3 = April)

    // If current month is January-April (0-3), use last calendar year
    // Otherwise, use year-to-date
    const defaultFromDate = currentMonth <= 3
        ? `${currentYear - 1}-01-01`
        : `${currentYear}-01-01`
    const defaultToDate = currentMonth <= 3
        ? `${currentYear - 1}-12-31`
        : now.toISOString().split('T')[0]

    const [activities, setActivities] = useState(initialActivities)
    const [fromDate, setFromDate] = useState(defaultFromDate)
    const [toDate, setToDate] = useState(defaultToDate)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(initialActivities.length >= 200)
    const [modalOpen, setModalOpen] = useState(false)
    const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null)
    const [bookModalOpen, setBookModalOpen] = useState(false)
    const [periodPdfModalOpen, setPeriodPdfModalOpen] = useState(false)

    // Load activities for selected athlete when in admin mode
    useEffect(() => {
        async function loadAthleteActivities() {
            if (!adminMode || !selectedAthleteId || selectedAthleteId === athleteId) {
                // Not in admin mode or viewing own activities - use initial
                setActivities(initialActivities)
                return
            }

            // In admin mode viewing another athlete - load from cache
            setLoading(true)
            try {
                const response = await fetch(`/api/cached-activities?athleteId=${selectedAthleteId}`)
                const data = await response.json()
                if (data.activities) {
                    setActivities(data.activities)
                    setHasMore(false) // Cached activities don't support pagination
                }
            } catch (error) {
                console.error('Failed to load athlete activities:', error)
            } finally {
                setLoading(false)
            }
        }

        loadAthleteActivities()
    }, [adminMode, selectedAthleteId, athleteId, initialActivities])

    const handleFilter = async () => {
        // In admin mode viewing another athlete, filter client-side
        if (adminMode && selectedAthleteId !== athleteId) {
            const fromTime = fromDate ? new Date(fromDate).getTime() : 0
            const toTime = toDate ? new Date(toDate).getTime() : Infinity
            const filtered = activities.filter(a => {
                const activityTime = new Date(a.start_date_local.replace('Z', '')).getTime()
                return activityTime >= fromTime && activityTime <= toTime
            })
            setActivities(filtered)
            return
        }

        if (!fromDate && !toDate) {
            setActivities(initialActivities)
            setPage(1)
            setHasMore(initialActivities.length >= 200)
            return
        }

        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (fromDate) {
                const afterTimestamp = Math.floor(new Date(fromDate).getTime() / 1000)
                params.set('after', afterTimestamp.toString())
            }
            if (toDate) {
                const beforeTimestamp = Math.floor(new Date(toDate).getTime() / 1000)
                params.set('before', beforeTimestamp.toString())
            }
            params.set('per_page', '200')
            params.set('page', '1')

            const response = await fetch(`/api/activities?${params}`)
            const data = await response.json()
            setActivities(data.activities || [])
            setPage(1)
            setHasMore((data.activities || []).length >= 200)
        } catch (error) {
            console.error('Failed to filter activities:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadMore = async () => {
        // No pagination for cached activities in admin mode
        if (adminMode && selectedAthleteId !== athleteId) {
            return
        }

        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (fromDate) {
                const afterTimestamp = Math.floor(new Date(fromDate).getTime() / 1000)
                params.set('after', afterTimestamp.toString())
            }
            if (toDate) {
                const beforeTimestamp = Math.floor(new Date(toDate).getTime() / 1000)
                params.set('before', beforeTimestamp.toString())
            }
            params.set('per_page', '200')
            params.set('page', (page + 1).toString())

            const response = await fetch(`/api/activities?${params}`)
            const data = await response.json()
            const newActivities = data.activities || []

            setActivities([...activities, ...newActivities])
            setPage(page + 1)
            setHasMore(newActivities.length >= 200)
        } catch (error) {
            console.error('Failed to load more activities:', error)
        } finally {
            setLoading(false)
        }
    }

    const getWorkoutLabel = (workoutType?: number | null) => {
        if (workoutType === null || workoutType === undefined) return null
        return WORKOUT_TYPES[workoutType] || null
    }

    const isViewingOtherUser = adminMode && selectedAthleteId && selectedAthleteId !== athleteId

    return (
        <>
            <Header userName={athleteName} />

            <main className="min-h-screen bg-stone-50 text-stone-900 p-8">
                {/* Strava connection warning */}
                {stravaError && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <div className="p-3 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 flex items-center gap-2">
                            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>
                                Strava connection issue. Showing {cachedCount || 0} cached activities.
                                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API route requires full page navigation */}
                                <a href="/signin" className="ml-2 underline font-medium">Re-connect Strava</a>
                            </span>
                        </div>
                    </div>
                )}

                {/* Admin mode banner */}
                {isViewingOtherUser && (
                    <div className="max-w-6xl mx-auto mb-4">
                        <div className="p-3 bg-orange-50 text-orange-800 rounded border border-orange-200">
                            Viewing cached activities for Athlete {selectedAthleteId}. Data is from cache only (no live Strava connection).
                        </div>
                    </div>
                )}

                <div className="sticky top-14 z-10 bg-stone-50 pb-4 max-w-6xl mx-auto mb-8">
                    <div className="flex justify-between items-center mb-8 pt-4">
                        <div>
                            <h1 className="text-3xl font-bold text-stone-800">
                                {isViewingOtherUser ? `Athlete ${selectedAthleteId}'s Activities` : 'Your Activities'}
                            </h1>
                            <p className="text-stone-500">Select activities to include in your book</p>
                        </div>
                        <button
                            onClick={() => setBookModalOpen(true)}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded shadow hover:from-blue-700 hover:to-indigo-800 transition"
                        >
                            Generate Book
                        </button>
                    </div>

                    {/* Date Range Filter */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 mb-6">
                        <h2 className="text-sm font-semibold text-stone-700 mb-4">Filter by Date Range</h2>
                        <div className="flex gap-4 items-end flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs text-stone-500 mb-1">From Date</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                                <label className="block text-xs text-stone-500 mb-1">To Date</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <button
                                onClick={handleFilter}
                                disabled={loading}
                                className="px-6 py-2 bg-orange-600 text-white font-semibold rounded hover:bg-orange-700 transition disabled:bg-stone-300"
                            >
                                {loading ? 'Loading...' : 'Apply Filter'}
                            </button>
                            <button
                                onClick={() => {
                                    setFromDate(defaultFromDate)
                                    setToDate(defaultToDate)
                                    setActivities(initialActivities)
                                }}
                                className="px-4 py-2 border border-stone-300 text-stone-600 rounded hover:bg-stone-50 transition"
                            >
                                Reset
                            </button>
                            <button
                                onClick={() => setPeriodPdfModalOpen(true)}
                                disabled={activities.length === 0}
                                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded hover:bg-indigo-700 transition disabled:bg-stone-300 disabled:cursor-not-allowed"
                            >
                                Generate Period PDFs
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <div className="text-sm font-mono bg-stone-200 px-3 py-1 rounded inline-block">
                            Found {activities.length} activities
                            {isViewingOtherUser && ' (cached)'}
                        </div>

                        {hasMore && !isViewingOtherUser && (
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="px-4 py-2 bg-stone-800 text-white text-sm font-semibold rounded hover:bg-stone-700 transition disabled:bg-stone-300 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Loading...' : 'Load More Activities'}
                            </button>
                        )}
                    </div>
                </div>

                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activities.map((activity) => {
                        // Parse start_date_local as-is without timezone conversion
                        // Format: "2024-12-13T06:30:00Z" but we want to treat it as local time
                        const localDateStr = activity.start_date_local.replace('Z', '')
                        const localDate = new Date(localDateStr)
                        const workoutLabel = getWorkoutLabel(activity.workout_type)

                        // Format date and time consistently for SSR/client hydration
                        const year = localDate.getFullYear()
                        const month = (localDate.getMonth() + 1).toString().padStart(2, '0')
                        const day = localDate.getDate().toString().padStart(2, '0')
                        const dateString = `${month}/${day}/${year}`

                        const hours = localDate.getHours().toString().padStart(2, '0')
                        const minutes = localDate.getMinutes().toString().padStart(2, '0')
                        const timeString = `${hours}:${minutes}`

                        return (
                            <div key={activity.id} className="bg-white p-6 rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex gap-2 flex-wrap">
                                        <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-1 rounded">
                                            {activity.type}
                                        </span>
                                        {workoutLabel && workoutLabel !== 'Default' && (
                                            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                {workoutLabel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-stone-400 font-mono text-right">
                                        <div>{dateString}</div>
                                        <div className="text-stone-500">{timeString}</div>
                                    </div>
                                </div>
                                <h3 className="font-semibold text-lg mb-2 truncate" title={activity.name}>{activity.name}</h3>

                                <div className="grid grid-cols-3 gap-2 mt-4 text-sm text-stone-600">
                                    <div>
                                        <span className="block text-xs text-stone-400">Dist</span>
                                        {(activity.distance / 1000).toFixed(2)} km
                                    </div>
                                    <div>
                                        <span className="block text-xs text-stone-400">Time</span>
                                        {(activity.moving_time / 60).toFixed(0)} min
                                    </div>
                                    <div>
                                        <span className="block text-xs text-stone-400">Elev</span>
                                        {activity.total_elevation_gain} m
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <button
                                        onClick={() => {
                                            setSelectedActivity(activity)
                                            setModalOpen(true)
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border-2 border-orange-500 bg-orange-50 text-orange-700 text-sm font-semibold hover:bg-orange-100 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    >
                                        Generate PDF pages
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* PDF Generation Modal */}
                {selectedActivity && (
                    <PDFGenerationModal
                        activity={selectedActivity}
                        isOpen={modalOpen}
                        onClose={() => {
                            setModalOpen(false)
                            setSelectedActivity(null)
                        }}
                    />
                )}

                {/* Book Generation Modal */}
                <ManualBookGenerationModal
                    activities={activities}
                    isOpen={bookModalOpen}
                    onClose={() => setBookModalOpen(false)}
                    athleteName={isViewingOtherUser ? `Athlete ${selectedAthleteId}` : athleteName}
                />

                {/* Period PDF Generation Modal */}
                <PeriodPDFGenerationModal
                    activities={activities}
                    isOpen={periodPdfModalOpen}
                    onClose={() => setPeriodPdfModalOpen(false)}
                />
            </main>
        </>
    )
}
