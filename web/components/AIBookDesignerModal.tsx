'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { StravaActivity } from '@/lib/strava'
import { BookTheme, BookFormat, FORMATS } from '@/lib/book-types'

interface AIBookDesignerModalProps {
    activities: StravaActivity[]
    isOpen: boolean
    onClose: () => void
    initialConfig?: {
        title: string
        athleteName: string
        year: number
        format: BookFormat
    }
}

// Types for AI Book Designer outputs
interface ArtDirectorOutput {
    theme: BookTheme
    reasoning: string
    moodKeywords: string[]
}

interface Chapter {
    id: string
    title: string
    subtitle?: string
    month?: number
    year: number
    activities: unknown[]  // Full activity objects
    summary: string
    featuredActivityId?: number
    pageCount: number
}

interface NarratorOutput {
    chapters: Chapter[]
    highlights: unknown[]
    yearSummary: {
        title: string
        openingParagraph: string
        keyMilestones: string[]
        closingStatement: string
    }
}

interface DesignerProgress {
    completed: number
    total: number
    currentScore: number
    currentPage?: string
}

interface DesignSession {
    sessionId: string
    // API uses underscores: 'art_director', 'completed'
    status: 'pending' | 'art_director' | 'narrator' | 'designer' | 'completed' | 'error'
    progress?: {
        currentStage: string
        percentComplete: number
        message: string
    }
    output?: {
        artDirector?: ArtDirectorOutput
        narrator?: NarratorOutput
        designer?: {
            pages: unknown[]
            finalScore: number
        }
        finalBook?: unknown
    }
    partialOutput?: {
        hasArtDirector: boolean
        hasNarrator: boolean
        hasDesigner: boolean
        artDirectorTheme?: BookTheme
        chapterCount: number
        highlightCount: number
    }
    errors?: string[]
}

type DesignStep = 'configure' | 'art-director' | 'narrator' | 'designer' | 'complete' | 'error'

const STEP_CONFIG: Record<DesignStep, { title: string; description: string; icon: string }> = {
    'configure': { title: 'Configure', description: 'Set up your book', icon: '1' },
    'art-director': { title: 'Art Director', description: 'Creating visual theme...', icon: '2' },
    'narrator': { title: 'Narrator', description: 'Organizing chapters...', icon: '3' },
    'designer': { title: 'Designer', description: 'Laying out pages...', icon: '4' },
    'complete': { title: 'Complete', description: 'Your book is ready!', icon: '5' },
    'error': { title: 'Error', description: 'Something went wrong', icon: '!' },
}

export default function AIBookDesignerModal({
    activities,
    isOpen,
    onClose,
    initialConfig,
}: AIBookDesignerModalProps) {
    // Configuration state
    const [title, setTitle] = useState(initialConfig?.title || 'My Year in Running')
    const [athleteName, setAthleteName] = useState(initialConfig?.athleteName || 'Athlete')
    const [format, setFormat] = useState<BookFormat>(initialConfig?.format || FORMATS['10x10'])

    // Design process state
    const [currentStep, setCurrentStep] = useState<DesignStep>('configure')
    const [session, setSession] = useState<DesignSession | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)

    // Polling state
    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const sessionIdRef = useRef<string | null>(null)

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
            }
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
            }
        }
    }, [pdfUrl])

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setCurrentStep('configure')
            setSession(null)
            setErrorMessage(null)
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
                setPdfUrl(null)
            }
            if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
            }
        }
    }, [isOpen, pdfUrl])

    // Generate PDF from design session output
    const generatePdfFromDesign = useCallback(async (designSession: DesignSession) => {
        if (!designSession.output?.finalBook) return

        try {
            const response = await fetch('/api/generate-book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: activities,
                    config: {
                        title,
                        athleteName,
                        year: new Date(activities[0]?.start_date || Date.now()).getFullYear(),
                        format,
                        theme: designSession.output?.artDirector?.theme,
                    },
                }),
            })

            if (response.ok) {
                const pdfBlob = await response.blob()
                const url = URL.createObjectURL(pdfBlob)
                setPdfUrl(url)

                // Auto-download the PDF
                const link = document.createElement('a')
                link.href = url
                link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-ai-designed.pdf`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            }
        } catch (error) {
            console.error('Failed to generate PDF from design:', error)
        }
    }, [activities, title, athleteName, format])

    // Poll for status updates
    const pollStatus = useCallback(async (sessionId: string) => {
        try {
            const response = await fetch(`/api/ai-book-designer/status/${sessionId}`)
            if (!response.ok) {
                throw new Error('Failed to fetch status')
            }

            const data: DesignSession = await response.json()
            setSession(data)

            // Update current step based on status (API uses underscores)
            if (data.status === 'art_director') {
                setCurrentStep('art-director')
            } else if (data.status === 'narrator') {
                setCurrentStep('narrator')
            } else if (data.status === 'designer') {
                setCurrentStep('designer')
            } else if (data.status === 'completed') {
                setCurrentStep('complete')
                // Generate PDF from the design output
                await generatePdfFromDesign(data)
                // Stop polling on complete
                if (pollingRef.current) {
                    clearInterval(pollingRef.current)
                    pollingRef.current = null
                }
            } else if (data.status === 'error') {
                setCurrentStep('error')
                setErrorMessage(data.errors?.[0] || 'An error occurred during design generation')
                // Stop polling on error
                if (pollingRef.current) {
                    clearInterval(pollingRef.current)
                    pollingRef.current = null
                }
            }
        } catch (error) {
            console.error('Failed to poll status:', error)
            // Don't stop polling on transient errors
        }
    }, [generatePdfFromDesign])

    // Start the design process
    const startDesign = useCallback(async () => {
        setCurrentStep('art-director')
        setErrorMessage(null)

        try {
            const response = await fetch('/api/ai-book-designer/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: activities.map(a => ({
                        id: a.id,
                        name: a.name,
                        type: a.type,
                        distance: a.distance,
                        moving_time: a.moving_time,
                        total_elevation_gain: a.total_elevation_gain,
                        start_date: a.start_date,
                        start_date_local: a.start_date_local,
                        workout_type: a.workout_type,
                        location_city: a.location_city,
                    })),
                    config: {
                        title,
                        athleteName,
                        year: new Date(activities[0]?.start_date || Date.now()).getFullYear(),
                        format,
                    },
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to start design session')
            }

            const data = await response.json()
            const sessionId = data.sessionId

            sessionIdRef.current = sessionId
            setSession({ sessionId, status: 'art_director' })

            // Start polling for updates
            pollingRef.current = setInterval(() => {
                pollStatus(sessionId)
            }, 2000) // Poll every 2 seconds

            // Initial poll
            await pollStatus(sessionId)

        } catch (error) {
            console.error('Failed to start design:', error)
            setCurrentStep('error')
            setErrorMessage(error instanceof Error ? error.message : 'Failed to start design session')
        }
    }, [activities, title, athleteName, format, pollStatus])

    // Retry after error
    const handleRetry = useCallback(() => {
        setCurrentStep('configure')
        setSession(null)
        setErrorMessage(null)
    }, [])

    // Download the generated PDF
    const handleDownload = useCallback(() => {
        if (pdfUrl) {
            const link = document.createElement('a')
            link.href = pdfUrl
            link.download = `${title.replace(/\s+/g, '-').toLowerCase()}-ai-designed.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }, [pdfUrl, title])

    // Cancel the design process
    const handleCancel = useCallback(() => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
        }
        setCurrentStep('configure')
        setSession(null)
    }, [])

    if (!isOpen) return null

    const steps: DesignStep[] = ['configure', 'art-director', 'narrator', 'designer', 'complete']
    const currentStepIndex = steps.indexOf(currentStep === 'error' ? 'configure' : currentStep)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-purple-700 text-white p-6 rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">AI Book Designer</h2>
                            <p className="text-violet-100 text-sm">
                                Let AI design your complete running book with a cohesive theme
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-violet-100 transition-colors"
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Progress Steps */}
                    {currentStep !== 'configure' && currentStep !== 'error' && (
                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                {steps.slice(1).map((step, idx) => {
                                    const isComplete = currentStepIndex > idx + 1
                                    const isCurrent = step === currentStep
                                    const config = STEP_CONFIG[step]

                                    return (
                                        <div key={step} className="flex items-center flex-1">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                                    isComplete
                                                        ? 'bg-white text-violet-700'
                                                        : isCurrent
                                                            ? 'bg-violet-400 text-white ring-4 ring-violet-300'
                                                            : 'bg-violet-800 text-violet-300'
                                                }`}>
                                                    {isComplete ? (
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        config.icon
                                                    )}
                                                </div>
                                                <span className={`text-xs mt-1 ${isCurrent ? 'text-white font-semibold' : 'text-violet-200'}`}>
                                                    {config.title}
                                                </span>
                                            </div>
                                            {idx < steps.length - 2 && (
                                                <div className={`flex-1 h-1 mx-2 rounded ${
                                                    isComplete ? 'bg-white' : 'bg-violet-800'
                                                }`} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Configuration Step */}
                    {currentStep === 'configure' && (
                        <div className="space-y-6">
                            {/* Book Summary */}
                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                                <h3 className="font-semibold text-violet-800 mb-2">What you&apos;re designing</h3>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="block text-xs text-violet-600">Activities</span>
                                        <span className="font-bold text-violet-900">{activities.length}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-violet-600">Races</span>
                                        <span className="font-bold text-violet-900">
                                            {activities.filter(a => a.workout_type === 1).length}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-violet-600">Total Distance</span>
                                        <span className="font-bold text-violet-900">
                                            {(activities.reduce((sum, a) => sum + a.distance, 0) / 1000).toFixed(0)} km
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Book Details */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Book Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-stone-500 mb-1">Book Title</label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            placeholder="My Year in Running"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-stone-500 mb-1">Athlete Name</label>
                                        <input
                                            type="text"
                                            value={athleteName}
                                            onChange={(e) => setAthleteName(e.target.value)}
                                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                                            placeholder="Your Name"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Format Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Book Format</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(FORMATS).map(([key, f]) => (
                                        <button
                                            key={key}
                                            onClick={() => setFormat(f)}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                format.size === f.size
                                                    ? 'border-violet-500 ring-2 ring-violet-200'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <span className="text-lg font-bold">{f.size}</span>
                                            <span className="block text-xs text-stone-500">inches</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* AI Design Explanation */}
                            <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
                                <h3 className="font-semibold text-violet-800 mb-2">How AI Design Works</h3>
                                <div className="space-y-2 text-sm text-violet-700">
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-violet-600">1.</span>
                                        <div>
                                            <span className="font-semibold">Art Director</span> analyzes your activities and creates a cohesive visual theme based on your races and locations.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-violet-600">2.</span>
                                        <div>
                                            <span className="font-semibold">Narrator</span> organizes your year into meaningful chapters with narrative flow.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-bold text-violet-600">3.</span>
                                        <div>
                                            <span className="font-semibold">Designer</span> creates beautiful page layouts, optimizing for visual impact and readability.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Start Button */}
                            <button
                                onClick={startDesign}
                                disabled={activities.length === 0}
                                className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-lg hover:from-violet-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                Start AI Design
                            </button>
                        </div>
                    )}

                    {/* Art Director Step */}
                    {currentStep === 'art-director' && (
                        <div className="py-8">
                            <div className="text-center mb-8">
                                <div className="w-24 h-24 mx-auto mb-4 bg-violet-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-violet-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-stone-800 mb-2">Art Director Working</h3>
                                <p className="text-stone-600">Analyzing your activities and creating a visual theme...</p>
                            </div>

                            {(session?.output?.artDirector || session?.partialOutput?.artDirectorTheme) && (
                                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-4">
                                    <h4 className="font-semibold text-violet-800">Theme Preview</h4>

                                    {/* Color Preview */}
                                    {(() => {
                                        const theme = session.output?.artDirector?.theme || session.partialOutput?.artDirectorTheme
                                        if (!theme) return null
                                        return (
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <div
                                                        className="h-12 rounded border border-stone-200"
                                                        style={{ backgroundColor: theme.primaryColor }}
                                                    />
                                                    <div className="text-xs text-stone-600 text-center mt-1">Primary</div>
                                                </div>
                                                <div className="flex-1">
                                                    <div
                                                        className="h-12 rounded border border-stone-200"
                                                        style={{ backgroundColor: theme.accentColor }}
                                                    />
                                                    <div className="text-xs text-stone-600 text-center mt-1">Accent</div>
                                                </div>
                                                <div className="flex-1">
                                                    <div
                                                        className="h-12 rounded border border-stone-200"
                                                        style={{ backgroundColor: theme.backgroundColor }}
                                                    />
                                                    <div className="text-xs text-stone-600 text-center mt-1">Background</div>
                                                </div>
                                            </div>
                                        )
                                    })()}

                                    {/* Reasoning */}
                                    {session.output?.artDirector?.reasoning && (
                                        <p className="text-sm text-violet-700 italic">
                                            &quot;{session.output.artDirector.reasoning}&quot;
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-stone-600 hover:text-stone-800 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Narrator Step */}
                    {currentStep === 'narrator' && (
                        <div className="py-8">
                            <div className="text-center mb-8">
                                <div className="w-24 h-24 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-emerald-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-stone-800 mb-2">Narrator Working</h3>
                                <p className="text-stone-600">Organizing your year into meaningful chapters...</p>
                            </div>

                            {(session?.output?.narrator || session?.partialOutput?.chapterCount) && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-4">
                                    <h4 className="font-semibold text-emerald-800">Chapter Preview</h4>

                                    {/* Chapter List */}
                                    {session.output?.narrator?.chapters && (
                                        <div className="space-y-2">
                                            {session.output.narrator.chapters.map((chapter, idx) => (
                                                <div key={idx} className="bg-white rounded-lg p-3 border border-emerald-200">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-semibold text-stone-800">{chapter.title}</span>
                                                        <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                                                            {chapter.activities?.length || 0} activities
                                                        </span>
                                                    </div>
                                                    {chapter.summary && (
                                                        <p className="text-sm text-stone-600 mt-1 italic">{chapter.summary}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Show partial progress */}
                                    {!session.output?.narrator && (session.partialOutput?.chapterCount ?? 0) > 0 && (
                                        <p className="text-sm text-emerald-600">
                                            {session.partialOutput?.chapterCount} chapters identified...
                                        </p>
                                    )}

                                    {/* Year Summary */}
                                    {session.output?.narrator?.yearSummary?.openingParagraph && (
                                        <p className="text-sm text-emerald-700 italic border-t border-emerald-200 pt-3">
                                            &quot;{session.output.narrator.yearSummary.openingParagraph}&quot;
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-stone-600 hover:text-stone-800 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Designer Step */}
                    {currentStep === 'designer' && (
                        <div className="py-8">
                            <div className="text-center mb-8">
                                <div className="w-24 h-24 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-stone-800 mb-2">Designer Working</h3>
                                <p className="text-stone-600">Creating beautiful page layouts...</p>
                            </div>

                            {(session?.progress || session?.partialOutput?.hasDesigner) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                                    <h4 className="font-semibold text-blue-800">Design Progress</h4>

                                    {/* Progress Bar */}
                                    {session.progress && (
                                        <div>
                                            <div className="flex justify-between text-sm text-blue-700 mb-1">
                                                <span>{session.progress.currentStage}</span>
                                                <span>{session.progress.percentComplete}%</span>
                                            </div>
                                            <div className="w-full bg-blue-200 rounded-full h-3">
                                                <div
                                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                                    style={{
                                                        width: `${session.progress.percentComplete}%`
                                                    }}
                                                />
                                            </div>
                                            <p className="text-sm text-blue-600 text-center mt-2">
                                                {session.progress.message}
                                            </p>
                                        </div>
                                    )}

                                    {/* Design Score (if available) */}
                                    {session.output?.designer?.finalScore && session.output.designer.finalScore > 0 && (
                                        <div className="flex items-center justify-center gap-2">
                                            <span className="text-sm text-blue-700">Design Quality Score:</span>
                                            <span className="font-bold text-blue-900">
                                                {session.output.designer.finalScore}/100
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-stone-600 hover:text-stone-800 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Complete Step */}
                    {currentStep === 'complete' && (
                        <div className="py-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Your Book is Ready!</h3>
                            <p className="text-stone-600 mb-6">
                                AI has designed a custom book from your {activities.length} activities
                            </p>

                            {/* Theme Summary */}
                            {session?.output?.artDirector?.theme && (
                                <div className="bg-stone-50 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                                    <h4 className="font-semibold text-stone-800 mb-2">Theme Applied</h4>
                                    <div className="flex gap-2 mb-2">
                                        <div
                                            className="w-8 h-8 rounded border"
                                            style={{ backgroundColor: session.output.artDirector.theme.primaryColor }}
                                            title="Primary Color"
                                        />
                                        <div
                                            className="w-8 h-8 rounded border"
                                            style={{ backgroundColor: session.output.artDirector.theme.accentColor }}
                                            title="Accent Color"
                                        />
                                    </div>
                                    {session.output.artDirector.reasoning && (
                                        <p className="text-xs text-stone-600 italic">
                                            {session.output.artDirector.reasoning}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Chapter Summary */}
                            {session?.output?.narrator?.chapters && (
                                <div className="bg-stone-50 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                                    <h4 className="font-semibold text-stone-800 mb-2">
                                        {session.output.narrator.chapters.length} Chapters Created
                                    </h4>
                                    <ul className="text-sm text-stone-600 space-y-1">
                                        {session.output.narrator.chapters.slice(0, 4).map((chapter, idx) => (
                                            <li key={idx}>- {chapter.title}</li>
                                        ))}
                                        {session.output.narrator.chapters.length > 4 && (
                                            <li className="text-stone-400">
                                                ...and {session.output.narrator.chapters.length - 4} more
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}

                            {/* Design Score */}
                            {session?.output?.designer && (
                                <div className="bg-stone-50 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                                    <h4 className="font-semibold text-stone-800 mb-2">Design Summary</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-xs text-stone-500">Pages</span>
                                            <span className="font-bold">{session.output.designer.pages?.length || 0}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-stone-500">Quality Score</span>
                                            <span className="font-bold">{session.output.designer.finalScore}/100</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleDownload}
                                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                                >
                                    Download PDF
                                </button>
                                {pdfUrl && (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3 border-2 border-violet-500 text-violet-600 font-bold rounded-lg hover:bg-violet-50 transition-colors"
                                    >
                                        Preview in New Tab
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Step */}
                    {currentStep === 'error' && (
                        <div className="py-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Design Failed</h3>
                            <p className="text-red-600 mb-6">{errorMessage || 'An error occurred during design generation'}</p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={handleRetry}
                                    className="px-6 py-3 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-700 transition-colors"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-3 border-2 border-stone-300 text-stone-600 font-bold rounded-lg hover:bg-stone-50 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
