'use client'

import { useState, useCallback, useEffect } from 'react'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, FORMATS, BookTheme, DEFAULT_THEME } from '@/lib/book-types'
import { generatePeriodName, getDefaultDateRange } from '@/lib/period-name-generator'
import { getRaces, getMonthlyHighlights } from '@/lib/activity-scoring'
import PhotoSelector, { extractPhotosFromActivities, PhotoOption } from './PhotoSelector'

interface ManualBookGenerationModalProps {
  activities: StravaActivity[]
  isOpen: boolean
  onClose: () => void
  athleteName?: string
}

type ModalStep = 'dates' | 'fetch' | 'inputs' | 'generate' | 'complete' | 'error'

interface FetchProgress {
  phase: 'idle' | 'fetching_activities' | 'fetching_races' | 'fetching_highlights' | 'complete'
  total: number
  completed: number
  message: string
}

interface BookConfig {
  bookName: string
  forewordText: string
  coverPhotoUrl: string | null
  backgroundPhotoUrl: string | null
  backCoverPhotoUrl: string | null
  startDate: string
  endDate: string
  format: BookFormat
  theme: BookTheme
}

interface GeneratedData {
  races: StravaActivity[]
  highlights: Map<string, StravaActivity | null>
  enrichedActivities: StravaActivity[]
  allPhotos: PhotoOption[]
}

export default function ManualBookGenerationModal({
  activities: initialActivities,
  isOpen,
  onClose,
  athleteName = 'Athlete',
}: ManualBookGenerationModalProps) {
  // Calculate default date range
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

  const initialDates = getInitialDateRange()

  // Filter activities by date range (declared early to use in useEffect)
  const filterActivitiesByDate = useCallback((activities: StravaActivity[], start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)

    return activities.filter(a => {
      const actDate = new Date(a.start_date_local || a.start_date)
      return actDate >= startDate && actDate <= endDate
    })
  }, [])

  // State
  const [step, setStep] = useState<ModalStep>('dates')
  const [config, setConfig] = useState<BookConfig>({
    bookName: '',
    forewordText: '',
    coverPhotoUrl: null,
    backgroundPhotoUrl: null,
    backCoverPhotoUrl: null,
    startDate: initialDates.startDate,
    endDate: initialDates.endDate,
    format: FORMATS['10x10'],
    theme: DEFAULT_THEME,
  })
  const [fetchProgress, setFetchProgress] = useState<FetchProgress>({
    phase: 'idle',
    total: 0,
    completed: 0,
    message: '',
  })
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [generateMessage, setGenerateMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [scoresMarkdown, setScoresMarkdown] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('dates')
      setFetchProgress({ phase: 'idle', total: 0, completed: 0, message: '' })
      setGeneratedData(null)
      setGenerateProgress(0)
      setGenerateMessage('')
      setErrorMessage('')
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }
      setScoresMarkdown(null)

      const dates = getInitialDateRange()
      const activities = filterActivitiesByDate(initialActivities, dates.startDate, dates.endDate)
      setConfig(prev => ({
        ...prev,
        startDate: dates.startDate,
        endDate: dates.endDate,
        bookName: generatePeriodName(new Date(dates.startDate), new Date(dates.endDate), activities),
      }))
    }
  }, [isOpen, initialActivities, getInitialDateRange, pdfUrl, filterActivitiesByDate])

  const filteredActivities = filterActivitiesByDate(
    initialActivities,
    config.startDate,
    config.endDate
  )

  // Step 1: Handle date confirmation
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value }
      // Regenerate book name
      const start = new Date(newConfig.startDate)
      const end = new Date(newConfig.endDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const filtered = filterActivitiesByDate(initialActivities, newConfig.startDate, newConfig.endDate)
        newConfig.bookName = generatePeriodName(start, end, filtered)
      }
      return newConfig
    })
  }

  // Step 2: Fetch activity data
  const handleFetchActivities = async () => {
    setStep('fetch')
    setFetchProgress({
      phase: 'fetching_activities',
      total: 0,
      completed: 0,
      message: 'Preparing to fetch activities...',
    })

    try {
      // Filter activities to date range
      const rangeActivities = filterActivitiesByDate(
        initialActivities,
        config.startDate,
        config.endDate
      )

      // Identify races
      const races = getRaces(rangeActivities)
      setFetchProgress({
        phase: 'fetching_races',
        total: races.length,
        completed: 0,
        message: `Found ${races.length} races. Fetching detailed data...`,
      })

      // Identify highlight activities (one per month)
      const highlights = getMonthlyHighlights(rangeActivities)
      const highlightActivities = Array.from(highlights.values()).filter(Boolean) as StravaActivity[]

      setFetchProgress({
        phase: 'fetching_highlights',
        total: races.length + highlightActivities.length,
        completed: 0,
        message: `Found ${highlightActivities.length} monthly highlights. Fetching detailed data...`,
      })

      // Fetch detailed data for races and highlights
      const activityIdsToFetch = new Set<number>()
      races.forEach(r => activityIdsToFetch.add(r.id))
      highlightActivities.forEach(h => activityIdsToFetch.add(h.id))

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

      // Build enriched activities array (replace with enriched where available)
      const enrichedActivities = rangeActivities.map(a => enrichedMap.get(a.id) || a)

      // Extract all photos
      const allPhotos = extractPhotosFromActivities(enrichedActivities)

      setGeneratedData({
        races: races.map(r => enrichedMap.get(r.id) || r),
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

      // Move to inputs step
      setTimeout(() => setStep('inputs'), 500)
    } catch (error) {
      console.error('Fetch error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch activity data')
      setStep('error')
    }
  }

  // Step 4: Generate book
  const handleGenerateBook = async () => {
    if (!generatedData) return

    setStep('generate')
    setGenerateProgress(0)
    setGenerateMessage('Preparing book generation...')

    try {
      setGenerateProgress(10)
      setGenerateMessage('Sending data to server...')

      const response = await fetch('/api/generate-manual-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activities: generatedData.enrichedActivities,
          races: generatedData.races,
          highlightActivityIds: Array.from(generatedData.highlights.entries())
            .filter(([, a]) => a !== null)
            .map(([month, a]) => ({ month, activityId: a!.id })),
          config: {
            bookName: config.bookName,
            athleteName,
            startDate: config.startDate,
            endDate: config.endDate,
            forewordText: config.forewordText || undefined,
            coverPhotoUrl: config.coverPhotoUrl,
            backgroundPhotoUrl: config.backgroundPhotoUrl,
            backCoverPhotoUrl: config.backCoverPhotoUrl,
            format: config.format,
            theme: config.theme,
          },
        }),
      })

      // Simulate progress while waiting
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

      // Get PDF blob
      const pdfBlob = await response.blob()
      const url = URL.createObjectURL(pdfBlob)
      setPdfUrl(url)

      // Check for scores report in header
      const scoresHeader = response.headers.get('X-Scores-Report')
      if (scoresHeader) {
        try {
          const decoded = atob(scoresHeader)
          setScoresMarkdown(decoded)
        } catch (e) {
          console.warn('Failed to decode scores report:', e)
        }
      }

      setGenerateProgress(100)
      setGenerateMessage('Book generated successfully!')

      // Auto-download using the url we just created
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = url
        link.download = `${config.bookName.replace(/\s+/g, '-').toLowerCase()}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, 100)

      setStep('complete')
    } catch (error) {
      console.error('Generation error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate book')
      setStep('error')
    }
  }

  // Download handlers
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
      const blob = new Blob([scoresMarkdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${config.bookName.replace(/\s+/g, '-').toLowerCase()}-scores.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }
  }

  const handleClose = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">Generate Book</h2>
              <p className="text-blue-100 text-sm">
                Create a print-ready PDF book from your activities
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-blue-100 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {['dates', 'fetch', 'inputs', 'generate', 'complete'].map((s, idx) => {
              const stepNames = ['Dates', 'Fetch', 'Configure', 'Generate', 'Complete']
              const stepIndex = ['dates', 'fetch', 'inputs', 'generate', 'complete'].indexOf(step)
              const isActive = s === step
              const isComplete = idx < stepIndex
              const isError = step === 'error'

              return (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isError && isActive
                        ? 'bg-red-500 text-white'
                        : isComplete
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-white text-blue-600'
                        : 'bg-blue-400 text-blue-100'
                    }`}
                  >
                    {isComplete ? '✓' : idx + 1}
                  </div>
                  <span className={`ml-1 text-xs ${isActive ? 'text-white' : 'text-blue-200'}`}>
                    {stepNames[idx]}
                  </span>
                  {idx < 4 && (
                    <div className={`w-8 h-0.5 mx-2 ${isComplete ? 'bg-green-400' : 'bg-blue-400'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Dates */}
          {step === 'dates' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                <h3 className="font-semibold text-indigo-800 mb-3">Select Date Range</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-indigo-600 mb-1">From Date</label>
                    <input
                      type="date"
                      value={config.startDate}
                      onChange={(e) => handleDateChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-indigo-600 mb-1">To Date</label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={(e) => handleDateChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
                <p className="text-sm text-indigo-600">
                  {filteredActivities.length} activities in selected range
                </p>
              </div>

              <button
                onClick={handleFetchActivities}
                disabled={filteredActivities.length === 0}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Fetch */}
          {step === 'fetch' && (
            <div className="py-12 text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(fetchProgress.completed / Math.max(fetchProgress.total, 1)) * 251} 251`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">
                    {fetchProgress.total > 0
                      ? `${Math.round((fetchProgress.completed / fetchProgress.total) * 100)}%`
                      : '...'}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-stone-800 mb-2">Fetching Activity Data</h3>
              <p className="text-stone-600">{fetchProgress.message}</p>
            </div>
          )}

          {/* Step 3: Inputs */}
          {step === 'inputs' && generatedData && (
            <div className="space-y-6">
              {/* Book Name */}
              <div className="bg-stone-50 rounded-xl p-4">
                <h3 className="font-semibold text-stone-800 mb-3">Book Details</h3>
                <div className="mb-4">
                  <label className="block text-xs text-stone-500 mb-1">Book Name</label>
                  <input
                    type="text"
                    value={config.bookName}
                    onChange={(e) => setConfig(prev => ({ ...prev, bookName: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                    placeholder="My Running Year"
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-500 mb-1">Foreword (Optional)</label>
                  <textarea
                    value={config.forewordText}
                    onChange={(e) => setConfig(prev => ({ ...prev, forewordText: e.target.value }))}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                    placeholder="Write a personal message for your book..."
                  />
                </div>
              </div>

              {/* Photo Selection */}
              <div className="bg-stone-50 rounded-xl p-4 space-y-6">
                <h3 className="font-semibold text-stone-800 mb-3">Select Photos</h3>

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.coverPhotoUrl}
                  onSelect={(url) => setConfig(prev => ({ ...prev, coverPhotoUrl: url }))}
                  label="Cover Photo"
                  description="Main photo for the book cover"
                />

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.backgroundPhotoUrl}
                  onSelect={(url) => setConfig(prev => ({ ...prev, backgroundPhotoUrl: url }))}
                  label="Foreword Background"
                  description="Background photo for the foreword page (will be faded)"
                />

                <PhotoSelector
                  photos={generatedData.allPhotos}
                  selectedUrl={config.backCoverPhotoUrl}
                  onSelect={(url) => setConfig(prev => ({ ...prev, backCoverPhotoUrl: url }))}
                  label="Back Cover Photo"
                  description="Photo for the back cover"
                />
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-2">Book Summary</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="block text-xs text-blue-600">Activities</span>
                    <span className="font-bold text-blue-900">{generatedData.enrichedActivities.length}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-blue-600">Races</span>
                    <span className="font-bold text-blue-900">{generatedData.races.length}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-blue-600">Photos Available</span>
                    <span className="font-bold text-blue-900">{generatedData.allPhotos.length}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGenerateBook}
                className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg"
              >
                Generate Book
              </button>
            </div>
          )}

          {/* Step 4: Generate */}
          {step === 'generate' && (
            <div className="py-12 text-center">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${generateProgress * 2.51} 251`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">{generateProgress}%</span>
                </div>
              </div>
              <h3 className="text-xl font-semibold text-stone-800 mb-2">Generating Your Book</h3>
              <p className="text-stone-600">{generateMessage}</p>
              <p className="text-xs text-stone-400 mt-4">This may take a minute for large books...</p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-stone-800 mb-2">Your Book is Ready!</h3>
              <p className="text-stone-600 mb-6">{config.bookName}</p>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={handleDownloadPdf}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                >
                  Download PDF
                </button>
                {scoresMarkdown && (
                  <button
                    onClick={handleDownloadScores}
                    className="px-6 py-3 border-2 border-blue-500 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Download Scores Report
                  </button>
                )}
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 border-2 border-stone-300 text-stone-600 font-bold rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Preview in New Tab
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="py-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-stone-800 mb-2">Something Went Wrong</h3>
              <p className="text-red-600 mb-6">{errorMessage}</p>

              <button
                onClick={() => setStep('dates')}
                className="px-6 py-3 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
