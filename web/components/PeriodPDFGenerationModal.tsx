'use client'

import { useState, useCallback, useEffect } from 'react'
import { StravaActivity } from '@/lib/strava'
import { BookTheme, FORMATS, BookFormat } from '@/lib/book-types'
import { generatePeriodName, getDefaultDateRange } from '@/lib/period-name-generator'

interface PeriodPDFGenerationModalProps {
    activities: StravaActivity[]
    isOpen: boolean
    onClose: () => void
}

type GenerationStep = 'configure' | 'generating' | 'complete' | 'error'
type TemplateType = 'year_stats' | 'year_calendar' | 'monthly_divider' | 'activity_log' | 'concat_all'
type ColorBy = 'distance' | 'time' | 'count' | 'elevation'

interface TemplateOption {
    id: string
    template: TemplateType
    variant?: string
    colorBy?: ColorBy
    label: string
    group: string
}

// All available template options
const TEMPLATE_OPTIONS: TemplateOption[] = [
    // Year Summary group
    { id: 'year_stats_grid', template: 'year_stats', variant: 'stats-grid', label: 'YearStats (Stats Grid)', group: 'Year Summary' },
    { id: 'year_stats_infographic', template: 'year_stats', variant: 'infographic', label: 'YearStats (Infographic)', group: 'Year Summary' },
    { id: 'year_stats_comparison', template: 'year_stats', variant: 'comparison', label: 'YearStats (Comparison)', group: 'Year Summary' },

    // Year Calendar group
    { id: 'year_calendar_distance', template: 'year_calendar', colorBy: 'distance', label: 'YearCalendar - Distance', group: 'Year Calendar' },
    { id: 'year_calendar_time', template: 'year_calendar', colorBy: 'time', label: 'YearCalendar - Time', group: 'Year Calendar' },
    { id: 'year_calendar_count', template: 'year_calendar', colorBy: 'count', label: 'YearCalendar - Count', group: 'Year Calendar' },
    { id: 'year_calendar_elevation', template: 'year_calendar', colorBy: 'elevation', label: 'YearCalendar - Elevation', group: 'Year Calendar' },

    // Monthly Dividers group
    { id: 'monthly_minimal', template: 'monthly_divider', variant: 'minimal', label: 'All Monthly Dividers (Minimal)', group: 'Monthly Dividers' },
    { id: 'monthly_photo', template: 'monthly_divider', variant: 'photo-accent', label: 'All Monthly Dividers (Photo Accent)', group: 'Monthly Dividers' },
    { id: 'monthly_stats', template: 'monthly_divider', variant: 'stats-preview', label: 'All Monthly Dividers (Stats Preview)', group: 'Monthly Dividers' },

    // Activity Log group
    { id: 'activity_log_grid', template: 'activity_log', variant: 'grid', label: 'Activity Log (Grid)', group: 'Activity Log' },
    { id: 'activity_log_concise', template: 'activity_log', variant: 'concise', label: 'Activity Log (Concise)', group: 'Activity Log' },
    { id: 'activity_log_full', template: 'activity_log', variant: 'full', label: 'Activity Log (Full)', group: 'Activity Log' },

    // Concatenate All (special option)
    { id: 'concat_all', template: 'concat_all', label: 'Concatenate All (excludes Activity Log)', group: 'Combined' },
]

// Preset themes (subset from BookGenerationModal)
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

interface PeriodConfig {
    selectedTemplate: TemplateOption
    format: BookFormat
    theme: BookTheme
    themeName: string
    periodName: string
    startDate: string
    endDate: string
}

export default function PeriodPDFGenerationModal({
    activities,
    isOpen,
    onClose,
}: PeriodPDFGenerationModalProps) {
    // Get default date range from activities
    const getInitialDateRange = useCallback(() => {
        const { startDate, endDate } = getDefaultDateRange(activities)
        return {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        }
    }, [activities])

    const getInitialPeriodName = useCallback(() => {
        const { startDate, endDate } = getDefaultDateRange(activities)
        return generatePeriodName(startDate, endDate, activities)
    }, [activities])

    const initialDates = getInitialDateRange()

    const [step, setStep] = useState<GenerationStep>('configure')
    const [progress, setProgress] = useState(0)
    const [progressMessage, setProgressMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)

    const [config, setConfig] = useState<PeriodConfig>({
        selectedTemplate: TEMPLATE_OPTIONS[0],
        format: FORMATS['10x10'],
        theme: PRESET_THEMES.classic,
        themeName: 'classic',
        periodName: getInitialPeriodName(),
        startDate: initialDates.startDate,
        endDate: initialDates.endDate,
    })

    // Update config when activities change
    useEffect(() => {
        if (activities.length > 0) {
            const { startDate, endDate } = getDefaultDateRange(activities)
            const newPeriodName = generatePeriodName(startDate, endDate, activities)
            setConfig(prev => ({
                ...prev,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                periodName: newPeriodName,
            }))
        }
    }, [activities])

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

    const handleTemplateChange = (templateId: string) => {
        const template = TEMPLATE_OPTIONS.find(t => t.id === templateId)
        if (template) {
            setConfig(prev => ({ ...prev, selectedTemplate: template }))
        }
    }

    const handleThemeChange = (themeName: string) => {
        const theme = PRESET_THEMES[themeName]
        if (theme) {
            setConfig(prev => ({ ...prev, theme, themeName }))
        }
    }

    const handleFormatChange = (formatKey: string) => {
        const format = FORMATS[formatKey]
        if (format) {
            setConfig(prev => ({ ...prev, format }))
        }
    }

    const generatePdf = useCallback(async () => {
        setStep('generating')
        setProgress(0)
        setProgressMessage('Preparing template...')

        try {
            setProgress(10)
            await new Promise(resolve => setTimeout(resolve, 300))

            setProgress(20)
            setProgressMessage('Rendering PDF...')

            const { selectedTemplate, format, theme, periodName, startDate, endDate } = config

            const response = await fetch('/api/generate-period-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities,
                    template: selectedTemplate.template,
                    variant: selectedTemplate.variant,
                    colorBy: selectedTemplate.colorBy,
                    periodName,
                    startDate,
                    endDate,
                    format,
                    theme,
                }),
            })

            // Simulate progress while waiting
            const progressInterval = setInterval(() => {
                setProgress(prev => Math.min(prev + 5, 85))
            }, 400)

            if (!response.ok) {
                clearInterval(progressInterval)
                const errorData = await response.json()
                const errorMsg = errorData.details
                    ? `${errorData.error}: ${errorData.details}`
                    : errorData.error || 'Failed to generate PDF'
                throw new Error(errorMsg)
            }

            clearInterval(progressInterval)
            setProgress(90)
            setProgressMessage('Finalizing PDF...')

            const pdfBlob = await response.blob()
            const url = URL.createObjectURL(pdfBlob)
            setPdfUrl(url)

            setProgress(100)
            setProgressMessage('PDF generated successfully!')

            // Auto-download
            const link = document.createElement('a')
            link.href = url
            link.download = `${selectedTemplate.template.replace('_', '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            setStep('complete')
        } catch (error) {
            console.error('PDF generation error:', error)
            setErrorMessage(error instanceof Error ? error.message : 'Failed to generate PDF')
            setStep('error')
        }
    }, [activities, config])

    const downloadPdf = useCallback(() => {
        if (pdfUrl) {
            const link = document.createElement('a')
            link.href = pdfUrl
            link.download = `${config.selectedTemplate.template.replace('_', '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }, [pdfUrl, config.selectedTemplate])

    const handleClose = useCallback(() => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl)
            setPdfUrl(null)
        }
        setStep('configure')
        onClose()
    }, [pdfUrl, onClose])

    if (!isOpen) return null

    // Group template options for the dropdown
    const groupedTemplates = TEMPLATE_OPTIONS.reduce((acc, template) => {
        if (!acc[template.group]) {
            acc[template.group] = []
        }
        acc[template.group].push(template)
        return acc
    }, {} as Record<string, TemplateOption[]>)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6 rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">Generate Period PDFs</h2>
                            <p className="text-indigo-100 text-sm">
                                Create summary templates from your filtered activities
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:text-indigo-100 transition-colors"
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
                            {/* Activity Summary */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-indigo-800">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="font-medium">{activities.length} activities</span>
                                    <span className="text-indigo-600 text-sm">in selected date range</span>
                                </div>
                                <p className="text-sm text-indigo-600 mt-1">
                                    {config.periodName}
                                </p>
                            </div>

                            {/* Template Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-3">Select Template</h3>
                                <select
                                    value={config.selectedTemplate.id}
                                    onChange={(e) => handleTemplateChange(e.target.value)}
                                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-lg"
                                >
                                    {Object.entries(groupedTemplates).map(([group, templates]) => (
                                        <optgroup key={group} label={group}>
                                            {templates.map(template => (
                                                <option key={template.id} value={template.id}>
                                                    {template.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                                <p className="text-xs text-stone-500 mt-2">
                                    {config.selectedTemplate.template === 'concat_all'
                                        ? 'Generates YearStats + YearCalendar (all color options) + all MonthlyDividers in one PDF'
                                        : config.selectedTemplate.template === 'monthly_divider'
                                            ? 'Generates one page per month with activities'
                                            : 'Generates a single page PDF'}
                                </p>
                            </div>

                            {/* Theme Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Theme</h3>
                                <div className="grid grid-cols-5 gap-3">
                                    {Object.entries(PRESET_THEMES).map(([name, theme]) => (
                                        <button
                                            key={name}
                                            onClick={() => handleThemeChange(name)}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                                config.themeName === name
                                                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <div className="flex gap-1 mb-2 justify-center">
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
                            </div>

                            {/* Format Selection */}
                            <div className="bg-stone-50 rounded-xl p-4">
                                <h3 className="font-semibold text-stone-800 mb-4">Page Format</h3>
                                <div className="grid grid-cols-3 gap-3">
                                    {Object.entries(FORMATS).map(([key, format]) => (
                                        <button
                                            key={key}
                                            onClick={() => handleFormatChange(key)}
                                            className={`p-4 rounded-lg border-2 transition-all ${
                                                config.format.size === format.size
                                                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                                                    : 'border-stone-200 hover:border-stone-300'
                                            }`}
                                        >
                                            <span className="text-lg font-bold">{format.size}</span>
                                            <span className="block text-xs text-stone-500">inches</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Button */}
                            <button
                                onClick={generatePdf}
                                disabled={activities.length === 0}
                                className="w-full px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                Generate PDF
                            </button>
                            {activities.length === 0 && (
                                <p className="text-xs text-center text-amber-600">
                                    No activities in selected date range. Adjust the filter.
                                </p>
                            )}
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
                                        stroke="#6366f1"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeDasharray={`${progress * 2.51} 251`}
                                        transform="rotate(-90 50 50)"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-indigo-600">{progress}%</span>
                                </div>
                            </div>
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">Generating PDF</h3>
                            <p className="text-stone-600">{progressMessage}</p>
                            {config.selectedTemplate.template === 'concat_all' && (
                                <p className="text-xs text-stone-400 mt-4">Concatenating multiple templates...</p>
                            )}
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
                            <h3 className="text-xl font-semibold text-stone-800 mb-2">PDF Generated!</h3>
                            <p className="text-stone-600 mb-6">{config.selectedTemplate.label}</p>

                            <div className="flex gap-4 justify-center">
                                <button
                                    onClick={downloadPdf}
                                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
                                >
                                    Download Again
                                </button>
                                {pdfUrl && (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-6 py-3 border-2 border-indigo-500 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors"
                                    >
                                        Preview in New Tab
                                    </a>
                                )}
                            </div>

                            <button
                                onClick={() => setStep('configure')}
                                className="mt-6 text-stone-500 hover:text-stone-700 text-sm underline"
                            >
                                Generate another template
                            </button>
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
                                className="px-6 py-3 bg-stone-600 text-white font-bold rounded-lg hover:bg-stone-700 transition-all"
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
