'use client'

import { useState, useCallback, useEffect } from 'react'
import { StravaActivity } from '@/lib/strava'
import { BookTheme, FORMATS, BookFormat } from '@/lib/book-types'
import { estimatePageCount } from '@/components/templates/BookDocument'
import AIBookDesignerModal from '@/components/AIBookDesignerModal'
import { generatePeriodName, getDefaultDateRange, formatDateRange } from '@/lib/period-name-generator'

interface BookGenerationModalProps {
    activities: StravaActivity[]
    isOpen: boolean
    onClose: () => void
    athleteName?: string
}

type GenerationStep = 'configure' | 'generating' | 'complete' | 'error'
type StylePreference = 'minimal' | 'bold' | 'classic' | 'ai'

interface BookConfig {
    title: string
    periodName: string
    athleteName: string
    startDate: string // ISO date string
    endDate: string   // ISO date string
    forewordText: string
    format: BookFormat
    theme: BookTheme
    stylePreference: StylePreference
    printReady: boolean // Insert blank pages for proper print spreads
}

// Preset themes users can choose from
// NOTE: Only using fonts that are verified as valid TTF files
// Valid fonts: Anton, ArchivoBlack, Bangers, BarlowCondensed, BebasNeue,
//              CrimsonText, IndieFlower, PatrickHand, PermanentMarker, HennyPenny,
//              Helvetica, Helvetica-Bold (built-in)
const PRESET_THEMES: Record<string, BookTheme> = {
    classic: {
        primaryColor: '#1e3a5f',
        accentColor: '#e67e22',
        backgroundColor: '#ffffff',
        fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
        backgroundStyle: 'solid',
    },
    bold: {
        primaryColor: '#1a1a1a',
        accentColor: '#ff6b35',
        backgroundColor: '#ffffff',
        fontPairing: { heading: 'Anton', body: 'CrimsonText' },
        backgroundStyle: 'solid',
    },
    minimal: {
        primaryColor: '#2c3e50',
        accentColor: '#95a5a6',
        backgroundColor: '#fafafa',
        fontPairing: { heading: 'Helvetica-Bold', body: 'Helvetica' },
        backgroundStyle: 'solid',
    },
    marathon: {
        primaryColor: '#0D2240',
        accentColor: '#FFD200',
        backgroundColor: '#ffffff',
        fontPairing: { heading: 'BebasNeue', body: 'BarlowCondensed' },
        backgroundStyle: 'solid',
    },
    trail: {
        primaryColor: '#2d5016',
        accentColor: '#8b4513',
        backgroundColor: '#faf8f5',
        fontPairing: { heading: 'Anton', body: 'CrimsonText' },
        backgroundStyle: 'solid',
    },
}

export default function BookGenerationModal({
    activities,
    isOpen,
    onClose,
    athleteName: initialAthleteName = 'Athlete',
}: BookGenerationModalProps) {
    // Get default date range from activities
    const getInitialDateRange = useCallback(() => {
        const { startDate, endDate } = getDefaultDateRange(activities)
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        }
    }, [activities])

    // Generate period name from date range and activities
    const getInitialPeriodName = useCallback(() => {
        const { startDate, endDate } = getDefaultDateRange(activities)
        return generatePeriodName(startDate, endDate, activities)
    }, [activities])

    const [step, setStep] = useState<GenerationStep>('configure')
    const [progress, setProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [generatingTheme, setGeneratingTheme] = useState(false)
    const [aiThemeReasoning, setAiThemeReasoning] = useState<string | null>(null)
    const [aiDesignerOpen, setAiDesignerOpen] = useState(false)

    const initialDates = getInitialDateRange()
    const [config, setConfig] = useState<BookConfig>({
        title: 'My Running Journey',
        periodName: getInitialPeriodName(),
        athleteName: initialAthleteName,
        startDate: initialDates.startDate,
        endDate: initialDates.endDate,
        forewordText: '',
        format: FORMATS['10x10'],
        theme: PRESET_THEMES.classic,
        stylePreference: 'classic',
        printReady: false,
    })

    // Update config when activities change
    useEffect(() => {
        const { startDate, endDate } = getDefaultDateRange(activities)
        const newPeriodName = generatePeriodName(startDate, endDate, activities)
        setConfig(prev => ({
            ...prev,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            periodName: newPeriodName,
        }))
    }, [activities])

    // Regenerate period name when dates change
    const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
        setConfig(prev => {
            const newConfig = { ...prev, [field]: value }
            // Regenerate period name suggestion
            const start = new Date(newConfig.startDate)
            const end = new Date(newConfig.endDate)
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                // Filter activities to the new date range for better naming
                const filteredActivities = activities.filter(a => {
                    const actDate = new Date(a.start_date_local || a.start_date)
                    return actDate >= start && actDate <= end
                })
                newConfig.periodName = generatePeriodName(start, end, filteredActivities)
            }
            return newConfig
        })
    }

    // Get activities filtered by the selected date range
    const filteredActivities = activities.filter(a => {
        const actDate = new Date(a.start_date_local || a.start_date)
        const start = new Date(config.startDate)
        const end = new Date(config.endDate)
        return actDate >= start && actDate <= end
    })

    // Use filtered activities for page estimation
    const pageEstimate = estimatePageCount(filteredActivities, config.format)

    // Cleanup PDF URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
            }
        }
    }, [pdfUrl])

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('configure')
            setProgress(0)
            setProgressMessage('')
            setErrorMessage('')
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl)
                setPdfUrl(null)
            }
        }
    }, [isOpen, pdfUrl])

    const handleThemeChange = (themeName: string) => {
        if (themeName === 'ai') {
            generateAiTheme()
            return
        }
        const theme = PRESET_THEMES[themeName]
        if (theme) {
            setConfig(prev => ({
                ...prev,
                theme,
                stylePreference: themeName as StylePreference,
            }))
            setAiThemeReasoning(null)
        }
    }

    const generateAiTheme = useCallback(async () => {
        setGeneratingTheme(true)
        setAiThemeReasoning(null)

        try {
            const response = await fetch('/api/generate-style-guide', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: activities,
                    preference: config.stylePreference !== 'ai' ? config.stylePreference : 'classic',
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to generate AI theme')
            }

            const result = await response.json()

            setConfig(prev => ({
                ...prev,
                theme: result.theme,
                stylePreference: 'ai',
            }))
            setAiThemeReasoning(result.reasoning)
        } catch (error) {
            console.error('AI theme generation error:', error)
            // Fallback to classic theme
            setConfig(prev => ({
                ...prev,
                theme: PRESET_THEMES.classic,
                stylePreference: 'classic',
            }))
        } finally {
            setGeneratingTheme(false)
        }
    }, [activities, config.stylePreference])

    const handleFormatChange = (formatKey: string) => {
        const format = FORMATS[formatKey]
        if (format) {
            setConfig(prev => ({ ...prev, format }))
        }
    }

    const generateBook = useCallback(async () => {
        setStep('generating')
        setProgress(0)
        setProgressMessage('Preparing book structure...')

        try {
            // Step 1: Prepare data (10%)
            setProgress(10)
            setProgressMessage(`Building ${pageEstimate.total} pages for ${filteredActivities.length} activities...`)

            await new Promise(resolve => setTimeout(resolve, 500)) // Brief pause for UI feedback

            // Step 2: Call the API to generate PDF (10-90%)
            setProgress(20)
            setProgressMessage('Rendering PDF pages...')

            const response = await fetch('/api/generate-book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: filteredActivities,
                    config: {
                        title: config.title,
                        periodName: config.periodName,
                        athleteName: config.athleteName,
                        year: new Date(config.endDate).getFullYear(),
                        startDate: config.startDate,
                        endDate: config.endDate,
                        forewordText: config.forewordText || undefined,
                        format: config.format,
                        theme: config.theme,
                        printReady: config.printReady,
                    },
                }),
            })

            // Simulate progress while waiting
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 85))
            }, 500)

            if (!response.ok) {
                clearInterval(progressInterval)
                const errorData = await response.json()
                const errorMsg = errorData.details
                    ? `${errorData.error}: ${errorData.details}`
                    : errorData.error || 'Failed to generate book'
                throw new Error(errorMsg)
            }

            clearInterval(progressInterval)
            setProgress(90)
            setProgressMessage('Finalizing PDF...')

            // Get the PDF blob
            console.log('[BookGenModal] Response OK, getting blob...')
            const pdfBlob = await response.blob()
            console.log('[BookGenModal] Got blob, size:', pdfBlob.size)
            const url = URL.createObjectURL(pdfBlob)
            console.log('[BookGenModal] Created blob URL:', url)
            setPdfUrl(url)

            setProgress(100)
            setProgressMessage('Book generated successfully!')

            // Auto-download the PDF immediately
            console.log('[BookGenModal] Starting auto-download...')
            const link = document.createElement('a')
            link.href = url
            link.download = `${config.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            console.log('[BookGenModal] Download triggered')

            setStep('complete')
            console.log('[BookGenModal] Set step to complete')
        } catch (error) {
            console.error('Book generation error:', error)
            setErrorMessage(error instanceof Error ? error.message : 'Failed to generate book')
            setStep('error')
        }
    }, [filteredActivities, config, pageEstimate.total])

    const downloadPdf = useCallback(() => {
        if (pdfUrl) {
            const link = document.createElement('a')
            link.href = pdfUrl
            link.download = `${config.title.replace(/\s+/g, '-').toLowerCase()}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }, [pdfUrl, config.title])

    const handleClose = useCallback(() => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl)
            setPdfUrl(null)
        }
        setStep('configure')
        onClose()
    }, [pdfUrl, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Create Your Book</h2>
                            <p className="text-blue-100 text-sm">
                                Build a coffee-table book from any training period, race buildup, or season
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
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Configuration Step */}
                    {step === 'configure' && (
                        <div className="space-y-6">
                            {/* Date Range Selection */}
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                                <h3 className="font-semibold text-indigo-800 mb-3">Time Period</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-indigo-600 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={config.startDate}
                                            onChange={(e) => handleDateChange('startDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-indigo-600 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            value={config.endDate}
                                            onChange={(e) => handleDateChange('endDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-indigo-600 mb-1">
                                        Period Name <span className="text-indigo-400">(appears on cover &amp; headers)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={config.periodName}
                                        onChange={(e) => setConfig(prev => ({ ...prev, periodName: e.target.value }))}
                                        className="w-full px-3 py-2 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-lg font-medium"
                                        placeholder="Road to Comrades 2025"
                                    />
                                    <p className="text-xs text-indigo-500 mt-1">
                                        {filteredActivities.length} activities in this period
                                    </p>
                                </div>
                            </div>

                            {/* Book Info */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Book Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-stone-500 mb-1">Book Title</label>
                                        <input
                                            type="text"
                                            value={config.title}
                                            onChange={(e) => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="My Running Journey"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-stone-500 mb-1">Athlete Name</label>
                                        <input
                                            type="text"
                                            value={config.athleteName}
                                            onChange={(e) => setConfig(prev => ({ ...prev, athleteName: e.target.value }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Your Name"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Foreword (optional) */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-2">Foreword (Optional)</h3>
                                <p className="text-xs text-stone-500 mb-2">Add a personal message at the beginning of your book</p>
                                <textarea
                                    value={config.forewordText}
                                    onChange={(e) => setConfig(prev => ({ ...prev, forewordText: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                                    placeholder="This year was incredible..."
                                />
                            </div>

                            {/* Theme Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Theme</h3>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {/* AI Theme Option */}
                                    <button
                                        onClick={() => handleThemeChange('ai')}
                                        disabled={generatingTheme}
                                        className={`p-3 rounded-lg border-2 transition-all relative ${
                                            config.stylePreference === 'ai'
                                                ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50'
                                                : 'border-stone-200 hover:border-purple-300 hover:bg-purple-50'
                                        } ${generatingTheme ? 'opacity-75' : ''}`}
                                    >
                                        {generatingTheme ? (
                                            <div className="flex gap-1 mb-2 justify-center">
                                                <div className="w-4 h-4 rounded-full bg-purple-300 animate-pulse" />
                                                <div className="w-4 h-4 rounded-full bg-purple-400 animate-pulse" />
                                            </div>
                                        ) : config.stylePreference === 'ai' ? (
                                            <div className="flex gap-1 mb-2">
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: config.theme.primaryColor }}
                                                />
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: config.theme.accentColor }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex gap-1 mb-2 justify-center">
                                                <span className="text-lg">&#x2728;</span>
                                            </div>
                                        )}
                                        <span className="text-xs font-medium text-purple-700">
                                            {generatingTheme ? 'Generating...' : 'AI Magic'}
                                        </span>
                                    </button>

                                    {/* Preset Themes */}
                                    {Object.entries(PRESET_THEMES).map(([name, theme]) => (
                                        <button
                                            key={name}
                                            onClick={() => handleThemeChange(name)}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                                config.stylePreference === name
                                                    ? 'border-blue-500 ring-2 ring-blue-200'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <div className="flex gap-1 mb-2">
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: theme.primaryColor }}
                                                />
                                                <div
                                                    className="w-4 h-4 rounded-full"
                                                    style={{ backgroundColor: theme.accentColor }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium capitalize">{name}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* AI Theme Reasoning */}
                                {aiThemeReasoning && config.stylePreference === 'ai' && (
                                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <p className="text-xs text-purple-700">
                                            <span className="font-semibold">AI reasoning:</span> {aiThemeReasoning}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Format Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Book Format</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(FORMATS).map(([key, format]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleFormatChange(key)}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                config.format.size === format.size
                                                    ? 'border-blue-500 ring-2 ring-blue-200'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <span className="text-lg font-bold">{format.size}</span>
                                            <span className="block text-xs text-stone-500">inches</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <h3 className="font-semibold text-blue-800 mb-2">Book Summary</h3>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="block text-xs text-blue-600">Activities</span>
                                        <span className="font-bold text-blue-900">{filteredActivities.length}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-blue-600">Estimated Pages</span>
                                        <span className="font-bold text-blue-900">{pageEstimate.total}</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs text-blue-600">Races</span>
                                        <span className="font-bold text-blue-900">{pageEstimate.breakdown.racePages / 2}</span>
                                    </div>
                                </div>
                                {filteredActivities.length === 0 && (
                                    <p className="mt-2 text-xs text-amber-600">
                                        No activities in selected date range. Adjust the dates above.
                                    </p>
                                )}
                            </div>

                            {/* Print-Ready Option */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.printReady}
                                        onChange={(e) => setConfig(prev => ({ ...prev, printReady: e.target.checked }))}
                                        className="mt-1 w-4 h-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <span className="font-semibold text-stone-800">Print-Ready</span>
                                        <p className="text-xs text-stone-500 mt-0.5">
                                            Insert blank pages so sections start on right-hand pages (for professional printing)
                                        </p>
                                    </div>
                                </label>
                            </div>

                            {/* Generate Buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={generateBook}
                                    disabled={filteredActivities.length === 0}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    Generate Book ({pageEstimate.total} pages)
                                </button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-stone-200" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-stone-500">or</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setAiDesignerOpen(true)}
                                    disabled={filteredActivities.length === 0}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-bold rounded-lg hover:from-violet-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    AI Design Book
                                </button>
                                <p className="text-xs text-center text-stone-500">
                                    Let AI create a cohesive theme and chapter organization
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Generating Step */}
                    {step === 'generating' && (
                        <div className="py-12 text-center">
                            <div className="relative w-32 h-32 mx-auto mb-6">
                                <svg className="w-full h-full animate-spin" viewBox="0 0 100 100">
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#e5e7eb"
                                        strokeWidth="8"
                                    />
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray={`${progress * 2.51} 251`}
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-blue-600">{progress}%</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Generating Your Book</h3>
                            <p className="text-stone-600">{progressMessage}</p>
                            <p className="text-xs text-stone-400 mt-4">This may take a minute for large books...</p>
                        </div>
                    )}

                    {/* Complete Step */}
                    {step === 'complete' && (
                        <div className="py-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Your Book is Ready!</h3>
                            <p className="text-stone-600 mb-6">{pageEstimate.total} pages celebrating &quot;{config.periodName}&quot;</p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={downloadPdf}
                                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                                >
                                    Download PDF
                                </button>
                                {pdfUrl && (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3 border-2 border-blue-500 text-blue-600 font-bold rounded-lg hover:bg-blue-50 transition-colors"
                                    >
                                        Preview in New Tab
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Error Step */}
                    {step === 'error' && (
                        <div className="py-12 text-center">
                            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Generation Failed</h3>
                            <p className="text-red-600 mb-6">{errorMessage}</p>

                            <button
                                onClick={() => setStep('configure')}
                                className="px-6 py-3 bg-stone-800 text-white font-bold rounded-lg hover:bg-stone-700 transition-colors"
                            >
                                Try Again
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Book Designer Modal */}
            <AIBookDesignerModal
                activities={filteredActivities}
                isOpen={aiDesignerOpen}
                onClose={() => setAiDesignerOpen(false)}
                initialConfig={{
                    title: config.title,
                    periodName: config.periodName,
                    athleteName: config.athleteName,
                    startDate: config.startDate,
                    endDate: config.endDate,
                    format: config.format,
                }}
            />
        </div>
    )
}
