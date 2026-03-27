'use client'

/* eslint-disable @next/next/no-img-element */
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, FORMATS, BookTheme } from '@/lib/book-types'
import { PhotoWithDimensions } from '@/lib/curator'
import { FOREWORD_MAX_CHARS } from '@/components/templates/Foreword'
import { generatePeriodName, getDefaultDateRange } from '@/lib/period-name-generator'
import { getRaces, getMonthlyHighlights, groupByMonth } from '@/lib/activity-scoring'
import PhotoSelector, { extractPhotosFromActivities, PhotoOption, SelectedPhoto } from './PhotoSelector'
import {
  RUNNING_THEME,
  CYCLING_THEME,
  TRAIL_RUNNING_THEME,
  TRIATHLON_THEME,
  MINIMAL_THEME,
  BOLD_THEME,
} from '@/lib/theme-defaults'

// ============================================================
// Types
// ============================================================

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

interface BookConfig {
  bookName: string
  forewordText: string
  coverPhoto: PhotoWithDimensions | null
  backgroundPhoto: PhotoWithDimensions | null
  backCoverPhoto: PhotoWithDimensions | null
  startDate: string
  endDate: string
  format: BookFormat
  theme: BookTheme
}

interface FetchProgress {
  phase: 'idle' | 'fetching_activities' | 'fetching_races' | 'fetching_highlights' | 'complete'
  total: number
  completed: number
  message: string
}

interface GeneratedData {
  races: StravaActivity[]
  highlights: Map<string, StravaActivity | null>
  enrichedActivities: StravaActivity[]
  allPhotos: PhotoOption[]
}

interface BookWizardProps {
  activities: StravaActivity[]
  athleteName: string
  stravaConnected: boolean
  activityCount: number
}

// ============================================================
// Theme metadata for display
// ============================================================

const THEME_OPTIONS = [
  { id: 'running', name: 'Running Classic', theme: RUNNING_THEME, description: 'Navy & gold, bold condensed type', preview: 'bg-[#0D2240]', accent: 'bg-[#FFD700]' },
  { id: 'cycling', name: 'Cycling Modern', theme: CYCLING_THEME, description: 'Blue & green, dynamic feel', preview: 'bg-[#005EB8]', accent: 'bg-[#00B140]' },
  { id: 'trail', name: 'Trail Running', theme: TRAIL_RUNNING_THEME, description: 'Forest & earth tones', preview: 'bg-[#2E5F3A]', accent: 'bg-[#D4AF37]' },
  { id: 'triathlon', name: 'Triathlon Bold', theme: TRIATHLON_THEME, description: 'Red & blue, gradient style', preview: 'bg-[#E31C23]', accent: 'bg-[#0055A4]' },
  { id: 'minimal', name: 'Minimal', theme: MINIMAL_THEME, description: 'Clean monochrome', preview: 'bg-[#1A1A1A]', accent: 'bg-[#666666]' },
  { id: 'bold', name: 'Bold Energy', theme: BOLD_THEME, description: 'Orange-red & gold, energetic', preview: 'bg-[#FF4500]', accent: 'bg-[#FFD700]' },
]

const FORMAT_OPTIONS = [
  { size: '8x8' as const, label: '8" x 8"', description: 'Compact, great for gifts', scale: 'w-16 h-16' },
  { size: '10x10' as const, label: '10" x 10"', description: 'Standard coffee table book', scale: 'w-20 h-20' },
  { size: '12x12' as const, label: '12" x 12"', description: 'Premium large format', scale: 'w-24 h-24' },
]

const STEP_LABELS = [
  'Data Source',
  'Date Range',
  'Highlights',
  'Theme & Format',
  'Preview',
  'Generate',
]

// ============================================================
// Main Component
// ============================================================

export default function BookWizard({
  activities: initialActivities,
  athleteName,
  stravaConnected,
  activityCount,
}: BookWizardProps) {
  const router = useRouter()

  // ---- Helpers ----
  const getInitialDateRange = useCallback(() => {
    if (initialActivities.length === 0) {
      const now = new Date()
      return {
        startDate: `${now.getFullYear()}-01-01`,
        endDate: now.toISOString().split('T')[0],
      }
    }
    const { startDate, endDate } = getDefaultDateRange(initialActivities)
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
  }, [initialActivities])

  const filterActivitiesByDate = useCallback((activities: StravaActivity[], start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)
    return activities.filter(a => {
      const actDate = new Date(a.start_date_local || a.start_date)
      return actDate >= startDate && actDate <= endDate
    })
  }, [])

  // ---- State ----
  const initialDates = getInitialDateRange()
  const [step, setStep] = useState<WizardStep>(1)
  const [config, setConfig] = useState<BookConfig>({
    bookName: '',
    forewordText: '',
    coverPhoto: null,
    backgroundPhoto: null,
    backCoverPhoto: null,
    startDate: initialDates.startDate,
    endDate: initialDates.endDate,
    format: FORMATS['10x10'],
    theme: RUNNING_THEME,
  })
  const [selectedThemeId, setSelectedThemeId] = useState('running')
  const [fetchProgress, setFetchProgress] = useState<FetchProgress>({
    phase: 'idle',
    total: 0,
    completed: 0,
    message: '',
  })
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [excludedActivityIds, setExcludedActivityIds] = useState<Set<number>>(new Set())
  const [aRaceIds, setARaceIds] = useState<Set<number>>(new Set())
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateMessage, setGenerateMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [scoresMarkdown, setScoresMarkdown] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  // ---- Derived ----
  const filteredActivities = useMemo(() =>
    filterActivitiesByDate(initialActivities, config.startDate, config.endDate),
    [initialActivities, config.startDate, config.endDate, filterActivitiesByDate]
  )

  const races = useMemo(() => getRaces(filteredActivities), [filteredActivities])

  const activityDensity = useMemo(() => {
    const byMonth = groupByMonth(filteredActivities)
    const months: { key: string; label: string; count: number }[] = []
    const startDate = new Date(config.startDate)
    const endDate = new Date(config.endDate)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (cursor <= endDate) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
      const label = `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`
      const count = (byMonth.get(key) || []).length
      months.push({ key, label, count })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }, [filteredActivities, config.startDate, config.endDate])

  const maxDensity = useMemo(() => Math.max(...activityDensity.map(m => m.count), 1), [activityDensity])

  // Initialize book name from date range
  useEffect(() => {
    if (initialActivities.length > 0) {
      const dates = getInitialDateRange()
      const activities = filterActivitiesByDate(initialActivities, dates.startDate, dates.endDate)
      setConfig(prev => ({
        ...prev,
        bookName: generatePeriodName(new Date(dates.startDate), new Date(dates.endDate), activities),
      }))
    }
  }, [initialActivities, getInitialDateRange, filterActivitiesByDate])

  // ---- Handlers ----
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value }
      const start = new Date(newConfig.startDate)
      const end = new Date(newConfig.endDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const filtered = filterActivitiesByDate(initialActivities, newConfig.startDate, newConfig.endDate)
        newConfig.bookName = generatePeriodName(start, end, filtered)
      }
      return newConfig
    })
  }

  const handleFetchActivities = async () => {
    setIsFetching(true)
    setFetchProgress({
      phase: 'fetching_activities',
      total: 0,
      completed: 0,
      message: 'Preparing to fetch activities...',
    })

    try {
      const rangeActivities = filterActivitiesByDate(initialActivities, config.startDate, config.endDate)
      const detectedRaces = getRaces(rangeActivities)

      setFetchProgress({
        phase: 'fetching_races',
        total: detectedRaces.length,
        completed: 0,
        message: `Found ${detectedRaces.length} races. Fetching detailed data...`,
      })

      const highlights = getMonthlyHighlights(rangeActivities)
      const highlightActivities = Array.from(highlights.values()).filter(Boolean) as StravaActivity[]

      // Find fastest run for best efforts
      const runs = rangeActivities.filter(a => a.type === 'Run' && a.distance >= 5000)
      const fastestRun = runs.length > 0
        ? runs.reduce((fastest, a) => {
            const currentPace = a.moving_time / a.distance
            const fastestPace = fastest.moving_time / fastest.distance
            return currentPace < fastestPace ? a : fastest
          })
        : null

      const activityIdsToFetch = new Set<number>()
      detectedRaces.forEach(r => activityIdsToFetch.add(r.id))
      highlightActivities.forEach(h => activityIdsToFetch.add(h.id))
      if (fastestRun) activityIdsToFetch.add(fastestRun.id)

      setFetchProgress({
        phase: 'fetching_highlights',
        total: activityIdsToFetch.size,
        completed: 0,
        message: `Fetching detailed data for ${activityIdsToFetch.size} activities...`,
      })

      const enrichedMap = new Map<number, StravaActivity>()
      let completed = 0

      for (const activityId of activityIdsToFetch) {
        try {
          const response = await fetch(`/api/comprehensive-activity-data?activityId=${activityId}`)
          if (response.ok) {
            const data = await response.json()
            const originalActivity = rangeActivities.find(a => a.id === activityId)
            if (originalActivity) {
              enrichedMap.set(activityId, {
                ...originalActivity,
                ...data.activity,
                comprehensiveData: {
                  photos: data.photos || [],
                  comments: data.comments || [],
                  streams: data.streams,
                },
              })
            }
          }
        } catch (err) {
          console.error(`Failed to fetch activity ${activityId}:`, err)
        }

        completed++
        setFetchProgress({
          phase: 'fetching_highlights',
          total: activityIdsToFetch.size,
          completed,
          message: `Fetching activity data... ${completed}/${activityIdsToFetch.size}`,
        })
      }

      const enrichedActivities = rangeActivities.map(a => enrichedMap.get(a.id) || a)
      const allPhotos = extractPhotosFromActivities(enrichedActivities)

      setGeneratedData({
        races: detectedRaces.map(r => enrichedMap.get(r.id) || r),
        highlights,
        enrichedActivities,
        allPhotos,
      })

      setFetchProgress({
        phase: 'complete',
        total: activityIdsToFetch.size,
        completed: activityIdsToFetch.size,
        message: 'Data fetching complete!',
      })

      // Auto-select detected races as A-races
      setARaceIds(new Set(detectedRaces.map(r => r.id)))

      setIsFetching(false)
      setStep(3)
    } catch (error) {
      console.error('Fetch error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch activity data')
      setIsFetching(false)
    }
  }

  const handleGenerateBook = async () => {
    if (!generatedData) return

    setStep(6)
    setGenerateProgress(0)
    setGenerateMessage('Preparing book generation...')

    try {
      // Filter out excluded activities
      const includedActivities = generatedData.enrichedActivities.filter(
        a => !excludedActivityIds.has(a.id)
      )
      const includedRaces = generatedData.races.filter(
        a => !excludedActivityIds.has(a.id)
      )

      setGenerateProgress(10)
      setGenerateMessage('Sending data to server...')

      const response = await fetch('/api/generate-manual-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activities: includedActivities,
          races: includedRaces,
          highlightActivityIds: Array.from(generatedData.highlights.entries())
            .filter(([, a]) => a !== null && !excludedActivityIds.has(a!.id))
            .map(([month, a]) => ({ month, activityId: a!.id })),
          config: {
            bookName: config.bookName,
            athleteName,
            startDate: config.startDate,
            endDate: config.endDate,
            forewordText: config.forewordText || undefined,
            coverPhoto: config.coverPhoto,
            backgroundPhoto: config.backgroundPhoto,
            backCoverPhoto: config.backCoverPhoto,
            format: config.format,
            theme: config.theme,
          },
        }),
      })

      const progressInterval = setInterval(() => {
        setGenerateProgress(prev => Math.min(prev + 5, 85))
        setGenerateMessage('Rendering PDF pages...')
      }, 500)

      if (!response.ok) {
        clearInterval(progressInterval)
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to generate book')
      }

      clearInterval(progressInterval)
      setGenerateProgress(90)
      setGenerateMessage('Finalizing PDF...')

      const pdfBlob = await response.blob()
      const url = URL.createObjectURL(pdfBlob)
      setPdfUrl(url)

      const scoresFilename = response.headers.get('X-Output-Scores')
      if (scoresFilename) {
        setScoresMarkdown(scoresFilename)
      }

      setGenerateProgress(100)
      setGenerateMessage('Book generated successfully!')

      // Auto-download
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = url
        link.download = `${config.bookName.replace(/\s+/g, '-').toLowerCase()}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, 100)
    } catch (error) {
      console.error('Generation error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate book')
      setGenerateProgress(-1)
    }
  }

  const handleDownloadPdf = () => {
    if (pdfUrl) {
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `${config.bookName.replace(/\s+/g, '-').toLowerCase()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleDownloadScores = () => {
    if (scoresMarkdown) {
      const link = document.createElement('a')
      link.href = `/api/outputs/${encodeURIComponent(scoresMarkdown)}`
      link.download = scoresMarkdown
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const goToStep = (target: WizardStep) => {
    // Only allow going to steps we've already visited or the next one
    if (target <= step) {
      setStep(target)
    }
  }

  const canProceed = (currentStep: WizardStep): boolean => {
    switch (currentStep) {
      case 1: return stravaConnected && initialActivities.length > 0
      case 2: return filteredActivities.length > 0
      case 3: return generatedData !== null
      case 4: return config.bookName.trim().length > 0
      case 5: return true
      default: return false
    }
  }

  // Estimated page count based on selected activities
  const estimatedPageCount = useMemo(() => {
    if (!generatedData) return 0
    const includedActivities = generatedData.enrichedActivities.filter(
      a => !excludedActivityIds.has(a.id)
    )
    const includedRaces = generatedData.races.filter(
      a => !excludedActivityIds.has(a.id)
    )
    const monthCount = new Set(
      includedActivities.map(a => {
        const d = new Date(a.start_date_local)
        return `${d.getFullYear()}-${d.getMonth()}`
      })
    ).size

    // Rough estimate: cover + TOC + foreword + year stats + year-at-a-glance +
    // (monthCount * (divider + activity log)) + (races * 2) + best efforts + back cover
    return 5 + (monthCount * 2) + (includedRaces.length * 2) + 2
  }, [generatedData, excludedActivityIds])

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/builder')}
              className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Activities</span>
            </button>
            <h1 className="text-lg font-bold text-stone-800">Create Your Book</h1>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>

          {/* Step Progress Bar */}
          <nav className="mt-4" aria-label="Wizard steps">
            <ol className="flex items-center gap-1">
              {STEP_LABELS.map((label, idx) => {
                const stepNum = (idx + 1) as WizardStep
                const isActive = step === stepNum
                const isComplete = step > stepNum
                const isAccessible = step >= stepNum

                return (
                  <li key={label} className="flex-1 flex items-center">
                    <button
                      onClick={() => isAccessible && goToStep(stepNum)}
                      disabled={!isAccessible}
                      className={`flex items-center gap-1.5 w-full group ${isAccessible ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                          isComplete
                            ? 'bg-green-500 text-white'
                            : isActive
                            ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                            : 'bg-stone-200 text-stone-500'
                        }`}
                      >
                        {isComplete ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          stepNum
                        )}
                      </div>
                      <span
                        className={`text-xs font-medium hidden sm:inline truncate ${
                          isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-stone-400'
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                    {idx < STEP_LABELS.length - 1 && (
                      <div className={`h-0.5 flex-1 mx-1 rounded ${step > stepNum ? 'bg-green-400' : 'bg-stone-200'}`} />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ============ STEP 1: Choose Data Source ============ */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">How would you like to get started?</h2>
              <p className="text-stone-500">Choose where to pull your activity data from</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Connect Strava */}
              <div
                className={`relative rounded-2xl border-2 p-8 transition-all ${
                  stravaConnected
                    ? 'border-green-400 bg-green-50'
                    : 'border-stone-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stravaConnected ? 'bg-green-500' : 'bg-orange-500'}`}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-stone-900">Connect Strava</h3>
                    {stravaConnected ? (
                      <p className="text-sm text-green-700">Connected</p>
                    ) : (
                      <p className="text-sm text-stone-500">Authorize with your account</p>
                    )}
                  </div>
                </div>

                {stravaConnected && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">Signed in as {athleteName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">{activityCount} activities loaded</span>
                    </div>
                  </div>
                )}

                {!stravaConnected && (
                  <a
                    href="/signin?callbackUrl=/builder/create"
                    className="inline-block mt-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    Connect Strava Account
                  </a>
                )}
              </div>

              {/* Upload Export */}
              <div className="relative rounded-2xl border-2 border-dashed border-stone-300 p-8 bg-white opacity-60">
                <div className="absolute top-4 right-4">
                  <span className="px-2 py-1 text-xs font-semibold bg-stone-200 text-stone-600 rounded-full">Coming Soon</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-stone-200 flex items-center justify-center">
                    <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-stone-900">Upload Export</h3>
                    <p className="text-sm text-stone-500">CSV or FIT file from Strava</p>
                  </div>
                </div>
                <div className="mt-4 p-6 border border-stone-200 rounded-xl text-center">
                  <svg className="w-10 h-10 mx-auto text-stone-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-xs text-stone-400">Drop files here or click to upload</p>
                </div>
              </div>
            </div>

            {/* Continue Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceed(1)}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue with Strava Data
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 2: Select Date Range ============ */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">Select Your Date Range</h2>
              <p className="text-stone-500">Choose the period you want to include in your book</p>
            </div>

            {/* Date Pickers */}
            <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-stone-900"
                  />
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{filteredActivities.length}</div>
                  <div className="text-xs text-blue-600 font-medium">Activities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">{races.length}</div>
                  <div className="text-xs text-blue-600 font-medium">Races</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {Math.round(filteredActivities.reduce((sum, a) => sum + a.distance, 0) / 1000)} km
                  </div>
                  <div className="text-xs text-blue-600 font-medium">Total Distance</div>
                </div>
              </div>
            </div>

            {/* Activity Density Chart */}
            {activityDensity.length > 0 && (
              <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <h3 className="text-sm font-semibold text-stone-700 mb-4">Activity Density</h3>
                <div className="flex items-end gap-1 h-32">
                  {activityDensity.map(month => (
                    <div key={month.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-blue-400 rounded-t transition-all group-hover:bg-blue-500"
                        style={{ height: `${(month.count / maxDensity) * 100}%`, minHeight: month.count > 0 ? '4px' : '0' }}
                      />
                      <span className="text-[9px] text-stone-400 truncate w-full text-center">{month.label.split(' ')[0]}</span>
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {month.label}: {month.count} activities
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-detected Period Name */}
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-sm text-stone-500 mb-1">Suggested book title:</p>
              <p className="text-xl font-bold text-stone-800">&ldquo;{config.bookName}&rdquo;</p>
            </div>

            {/* Navigation */}
            <div className="flex justify-between max-w-2xl mx-auto">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-stone-600 font-medium rounded-xl hover:bg-stone-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFetchActivities}
                disabled={!canProceed(2) || isFetching}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isFetching ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>{fetchProgress.message || 'Fetching...'}</span>
                  </>
                ) : (
                  'Fetch Activity Data'
                )}
              </button>
            </div>

            {/* Fetch Progress Overlay */}
            {isFetching && (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-sm text-center">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${(fetchProgress.completed / Math.max(fetchProgress.total, 1)) * 251} 251`}
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-300"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-blue-600">
                        {fetchProgress.total > 0
                          ? `${Math.round((fetchProgress.completed / fetchProgress.total) * 100)}%`
                          : '...'}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-800 mb-1">Fetching Activity Data</h3>
                  <p className="text-sm text-stone-500">{fetchProgress.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ STEP 3: Review Highlights ============ */}
        {step === 3 && generatedData && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">Review Your Highlights</h2>
              <p className="text-stone-500">We detected races and monthly highlights. Mark your most important races and toggle activities in or out.</p>
            </div>

            {/* Races Section */}
            {generatedData.races.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Races ({generatedData.races.length})
                </h3>
                <div className="space-y-3">
                  {generatedData.races.map(race => {
                    const isExcluded = excludedActivityIds.has(race.id)
                    const isARace = aRaceIds.has(race.id)
                    const raceDate = new Date(race.start_date_local)
                    const photos = race.comprehensiveData?.photos || []
                    const primaryPhoto = photos.length > 0 ? photos[0] : null
                    const primaryPhotoUrl = primaryPhoto ? (
                      Object.values(primaryPhoto.urls || {}).find((url): url is string => typeof url === 'string') || null
                    ) : null

                    return (
                      <div
                        key={race.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          isExcluded
                            ? 'border-stone-200 bg-stone-50 opacity-50'
                            : isARace
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-stone-200 bg-white'
                        }`}
                      >
                        {/* Photo thumbnail */}
                        {primaryPhotoUrl ? (
                          <img
                            src={primaryPhotoUrl}
                            alt={race.name}
                            className="w-16 h-16 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}

                        {/* Race Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-stone-800 truncate">{race.name}</h4>
                          <div className="flex gap-4 text-sm text-stone-500 mt-1">
                            <span>{raceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span>{(race.distance / 1000).toFixed(1)} km</span>
                            <span>{Math.floor(race.moving_time / 3600)}h {Math.floor((race.moving_time % 3600) / 60)}m</span>
                          </div>
                        </div>

                        {/* A-Race Toggle */}
                        <button
                          onClick={() => {
                            setARaceIds(prev => {
                              const next = new Set(prev)
                              if (next.has(race.id)) {
                                next.delete(race.id)
                              } else {
                                next.add(race.id)
                              }
                              return next
                            })
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all shrink-0 ${
                            isARace
                              ? 'border-orange-400 bg-orange-500 text-white'
                              : 'border-stone-300 text-stone-500 hover:border-orange-300 hover:text-orange-600'
                          }`}
                        >
                          A Race
                        </button>

                        {/* Include/Exclude Toggle */}
                        <button
                          onClick={() => {
                            setExcludedActivityIds(prev => {
                              const next = new Set(prev)
                              if (next.has(race.id)) {
                                next.delete(race.id)
                              } else {
                                next.add(race.id)
                              }
                              return next
                            })
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                            isExcluded
                              ? 'border-stone-300 bg-stone-100 text-stone-400'
                              : 'border-green-400 bg-green-500 text-white'
                          }`}
                        >
                          {isExcluded ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Monthly Summaries */}
            <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
              <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Monthly Activity Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activityDensity.filter(m => m.count > 0).map(month => {
                  const highlight = generatedData.highlights.get(month.key)
                  return (
                    <div key={month.key} className="p-4 rounded-xl border border-stone-100 bg-stone-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-stone-700">{month.label}</h4>
                          <p className="text-sm text-stone-500">{month.count} activities</p>
                        </div>
                        {highlight && (
                          <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                            Highlight
                          </span>
                        )}
                      </div>
                      {highlight && (
                        <p className="text-xs text-stone-500 mt-2 truncate" title={highlight.name}>
                          {highlight.name} &mdash; {(highlight.distance / 1000).toFixed(1)} km
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <div className="text-2xl font-bold text-stone-800">
                  {generatedData.enrichedActivities.length - excludedActivityIds.size}
                </div>
                <div className="text-xs text-stone-500">Activities Included</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <div className="text-2xl font-bold text-stone-800">
                  {generatedData.races.filter(r => !excludedActivityIds.has(r.id)).length}
                </div>
                <div className="text-xs text-stone-500">Races</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <div className="text-2xl font-bold text-stone-800">{generatedData.allPhotos.length}</div>
                <div className="text-xs text-stone-500">Photos Available</div>
              </div>
              <div className="bg-white rounded-xl p-4 border border-stone-200 text-center">
                <div className="text-2xl font-bold text-stone-800">{aRaceIds.size}</div>
                <div className="text-xs text-stone-500">A Races</div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 text-stone-600 font-medium rounded-xl hover:bg-stone-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={!canProceed(3)}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Choose Theme & Format
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 4: Choose Theme & Format ============ */}
        {step === 4 && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">Design Your Book</h2>
              <p className="text-stone-500">Choose a theme, format, and customize your book details</p>
            </div>

            {/* Book Name */}
            <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
              <label className="block text-sm font-semibold text-stone-700 mb-2">Book Title</label>
              <input
                type="text"
                value={config.bookName}
                onChange={(e) => setConfig(prev => ({ ...prev, bookName: e.target.value }))}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xl font-medium text-stone-900"
                placeholder="My Running Year"
              />
            </div>

            {/* Theme Selection */}
            <div>
              <h3 className="text-lg font-bold text-stone-800 mb-4">Theme</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {THEME_OPTIONS.map(option => {
                  const isSelected = selectedThemeId === option.id
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSelectedThemeId(option.id)
                        setConfig(prev => ({ ...prev, theme: option.theme }))
                      }}
                      className={`relative rounded-2xl border-2 p-4 transition-all text-left ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Color Preview */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-lg ${option.preview}`} />
                        <div className={`w-4 h-4 rounded-full ${option.accent}`} />
                      </div>
                      <h4 className="font-semibold text-stone-800 text-sm">{option.name}</h4>
                      <p className="text-xs text-stone-500 mt-0.5">{option.description}</p>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <h3 className="text-lg font-bold text-stone-800 mb-4">Book Size</h3>
              <div className="grid grid-cols-3 gap-4 max-w-2xl">
                {FORMAT_OPTIONS.map(option => {
                  const isSelected = config.format.size === option.size
                  return (
                    <button
                      key={option.size}
                      onClick={() => setConfig(prev => ({ ...prev, format: FORMATS[option.size] }))}
                      className={`rounded-2xl border-2 p-6 transition-all text-center ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      {/* Size visualization */}
                      <div className="flex justify-center mb-3">
                        <div className={`${option.scale} border-2 ${isSelected ? 'border-blue-400' : 'border-stone-300'} rounded-sm bg-stone-50`} />
                      </div>
                      <h4 className="font-bold text-stone-800">{option.label}</h4>
                      <p className="text-xs text-stone-500 mt-1">{option.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Foreword */}
            <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-stone-700">Foreword (Optional)</label>
                <span className={`text-xs ${config.forewordText.length > FOREWORD_MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-stone-400'}`}>
                  {config.forewordText.length}/{FOREWORD_MAX_CHARS}
                </span>
              </div>
              <textarea
                value={config.forewordText}
                onChange={(e) => setConfig(prev => ({ ...prev, forewordText: e.target.value.slice(0, FOREWORD_MAX_CHARS) }))}
                maxLength={FOREWORD_MAX_CHARS}
                className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none text-stone-900"
                placeholder="Write a personal message for your book..."
              />
              <p className="text-xs text-stone-400 mt-1">
                Tip: Shorter forewords (under 400 chars) display in a larger, more readable font.
              </p>
            </div>

            {/* Photo Selection */}
            {generatedData && generatedData.allPhotos.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm space-y-6">
                <h3 className="text-lg font-bold text-stone-800">Select Photos</h3>

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.coverPhoto?.url ?? null}
                  onSelect={(photo: SelectedPhoto | null) => setConfig(prev => ({
                    ...prev,
                    coverPhoto: photo ? { url: photo.url, width: photo.width, height: photo.height } : null,
                  }))}
                  label="Cover Photo"
                  description="Main photo for the book cover"
                />

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.backgroundPhoto?.url ?? null}
                  onSelect={(photo: SelectedPhoto | null) => setConfig(prev => ({
                    ...prev,
                    backgroundPhoto: photo ? { url: photo.url, width: photo.width, height: photo.height } : null,
                  }))}
                  label="Page Background"
                  description="Background photo for foreword, TOC, and stats pages (faded)"
                />

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.backCoverPhoto?.url ?? null}
                  onSelect={(photo: SelectedPhoto | null) => setConfig(prev => ({
                    ...prev,
                    backCoverPhoto: photo ? { url: photo.url, width: photo.width, height: photo.height } : null,
                  }))}
                  label="Back Cover Photo"
                  description="Photo for the back cover"
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep(3)}
                className="px-6 py-3 text-stone-600 font-medium rounded-xl hover:bg-stone-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={!canProceed(4)}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Preview & Refine
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 5: Preview & Refine ============ */}
        {step === 5 && generatedData && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">Preview & Refine</h2>
              <p className="text-stone-500">Review your book configuration before generating</p>
            </div>

            {/* Book Summary Card */}
            <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              {/* Cover Preview */}
              <div
                className="h-48 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: config.theme.primaryColor }}
              >
                {config.coverPhoto?.url && (
                  <img
                    src={config.coverPhoto.url}
                    alt="Cover"
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                )}
                <div className="relative text-center z-10 px-6">
                  <h3 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: config.theme.fontPairing.heading }}>
                    {config.bookName}
                  </h3>
                  <p className="text-sm text-white/70">{athleteName}</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Format</div>
                    <div className="font-semibold text-stone-800">{config.format.size}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Theme</div>
                    <div className="font-semibold text-stone-800">
                      {THEME_OPTIONS.find(t => t.id === selectedThemeId)?.name || 'Custom'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Estimated Pages</div>
                    <div className="font-semibold text-stone-800">~{estimatedPageCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-stone-500 mb-1">Date Range</div>
                    <div className="font-semibold text-stone-800 text-sm">
                      {new Date(config.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} &mdash;{' '}
                      {new Date(config.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>

                <hr className="my-6 border-stone-200" />

                {/* Content Overview */}
                <h4 className="text-sm font-semibold text-stone-700 mb-3">Book Contents</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Cover Page
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Table of Contents
                  </div>
                  {config.forewordText && (
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      Foreword
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Year at a Glance + Year Stats
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    {activityDensity.filter(m => m.count > 0).length} Monthly Sections
                  </div>
                  {generatedData.races.filter(r => !excludedActivityIds.has(r.id)).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <div className="w-2 h-2 rounded-full bg-orange-400" />
                      {generatedData.races.filter(r => !excludedActivityIds.has(r.id)).length} Race Pages
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    Best Efforts + Back Cover
                  </div>
                </div>

                {/* Photo Summary */}
                {(config.coverPhoto?.url || config.backgroundPhoto?.url || config.backCoverPhoto?.url) && (
                  <>
                    <hr className="my-6 border-stone-200" />
                    <h4 className="text-sm font-semibold text-stone-700 mb-3">Selected Photos</h4>
                    <div className="flex gap-4">
                      {config.coverPhoto?.url && (
                        <div className="text-center">
                          <img src={config.coverPhoto.url} alt="Cover" className="w-20 h-20 rounded-lg object-cover" />
                          <p className="text-xs text-stone-500 mt-1">Cover</p>
                        </div>
                      )}
                      {config.backgroundPhoto?.url && (
                        <div className="text-center">
                          <img src={config.backgroundPhoto.url} alt="Background" className="w-20 h-20 rounded-lg object-cover" />
                          <p className="text-xs text-stone-500 mt-1">Background</p>
                        </div>
                      )}
                      {config.backCoverPhoto?.url && (
                        <div className="text-center">
                          <img src={config.backCoverPhoto.url} alt="Back Cover" className="w-20 h-20 rounded-lg object-cover" />
                          <p className="text-xs text-stone-500 mt-1">Back Cover</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between max-w-3xl mx-auto">
              <button
                onClick={() => setStep(4)}
                className="px-6 py-3 text-stone-600 font-medium rounded-xl hover:bg-stone-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleGenerateBook}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg text-lg"
              >
                Generate Book
              </button>
            </div>
          </div>
        )}

        {/* ============ STEP 6: Generate & Download ============ */}
        {step === 6 && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-stone-900 mb-3">
                {generateProgress === 100 ? 'Your Book is Ready!' : generateProgress === -1 ? 'Generation Failed' : 'Generating Your Book'}
              </h2>
            </div>

            <div className="max-w-lg mx-auto">
              {/* Generating State */}
              {generateProgress >= 0 && generateProgress < 100 && (
                <div className="bg-white rounded-2xl p-10 border border-stone-200 shadow-sm text-center">
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="40" fill="none" stroke="#3b82f6" strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${generateProgress * 2.51} 251`}
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">{generateProgress}%</span>
                    </div>
                  </div>
                  <p className="text-stone-600 font-medium">{generateMessage}</p>
                  <p className="text-xs text-stone-400 mt-3">This may take a while for large books...</p>
                </div>
              )}

              {/* Success State */}
              {generateProgress === 100 && (
                <div className="bg-white rounded-2xl p-10 border border-stone-200 shadow-sm text-center">
                  <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-stone-800 mb-2">{config.bookName}</h3>
                  <p className="text-sm text-stone-500 mb-8">Your book has been generated and downloaded!</p>

                  <div className="flex gap-3 justify-center flex-wrap">
                    <button
                      onClick={handleDownloadPdf}
                      className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                    >
                      Download PDF Again
                    </button>
                    {scoresMarkdown && (
                      <button
                        onClick={handleDownloadScores}
                        className="px-6 py-3 border-2 border-blue-500 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors"
                      >
                        Download Scores
                      </button>
                    )}
                    {pdfUrl && (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 border-2 border-stone-300 text-stone-600 font-bold rounded-xl hover:bg-stone-50 transition-colors"
                      >
                        Preview in New Tab
                      </a>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-stone-200">
                    <button
                      onClick={() => router.push('/builder')}
                      className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                    >
                      Back to Activities
                    </button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {generateProgress === -1 && (
                <div className="bg-white rounded-2xl p-10 border border-stone-200 shadow-sm text-center">
                  <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-stone-800 mb-2">Something Went Wrong</h3>
                  <p className="text-red-600 mb-6">{errorMessage}</p>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        setGenerateProgress(0)
                        setErrorMessage('')
                        setStep(5)
                      }}
                      className="px-6 py-3 bg-stone-800 text-white font-bold rounded-xl hover:bg-stone-700 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => router.push('/builder')}
                      className="px-6 py-3 border-2 border-stone-300 text-stone-600 font-bold rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      Back to Activities
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
