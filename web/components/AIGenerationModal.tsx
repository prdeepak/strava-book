'use client'

import { useState, useEffect } from 'react'
import { StravaActivity } from '@/lib/strava'

interface AIGenerationModalProps {
    activity: StravaActivity
    isOpen: boolean
    onClose: () => void
}

interface DataSelection {
    pageCount: 1 | 2 | 3
    includePhotos: boolean
    selectedPhotoIds: string[]
    includeComments: boolean
    includeSplits: boolean
    includeLaps: boolean
    includeBestEfforts: boolean
    includeElevation: boolean
}

export default function AIGenerationModal({ activity, isOpen, onClose }: AIGenerationModalProps) {
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showOfflineOption, setShowOfflineOption] = useState(false)
    const [aiResult, setAiResult] = useState<any>(null)

    // Configuration state
    const [configuring, setConfiguring] = useState(true)
    const [fetchingData, setFetchingData] = useState(false)
    const [comprehensiveData, setComprehensiveData] = useState<any>(null)
    const [dataSelection, setDataSelection] = useState<DataSelection>({
        pageCount: 1,
        includePhotos: true,
        selectedPhotoIds: [],
        includeComments: true,
        includeSplits: true,
        includeLaps: true,
        includeBestEfforts: true,
        includeElevation: true,
    })

    // Fetch comprehensive data when modal opens
    useEffect(() => {
        if (isOpen && !comprehensiveData) {
            fetchComprehensiveData()
        }
    }, [isOpen])

    const fetchComprehensiveData = async () => {
        setFetchingData(true)
        try {
            const dataResponse = await fetch(`/api/comprehensive-activity-data?activityId=${activity.id}`)

            if (!dataResponse.ok) {
                throw new Error('Failed to gather activity data')
            }

            const data = await dataResponse.json()
            setComprehensiveData(data)

            // Select all photos by default
            if (data.photos && data.photos.length > 0) {
                setDataSelection(prev => ({
                    ...prev,
                    selectedPhotoIds: data.photos.map((p: any) => p.unique_id)
                }))
            }
        } catch (err) {
            console.error('Failed to fetch comprehensive data:', err)
            setError(err instanceof Error ? err.message : 'Failed to load activity data')
        } finally {
            setFetchingData(false)
        }
    }

    if (!isOpen) return null

    const handleGenerate = async () => {
        setConfiguring(false)
        setLoading(true)
        setError(null)
        setSuccess(false)
        setShowOfflineOption(false)

        // Show offline option after 30 seconds
        const offlineTimer = setTimeout(() => {
            setShowOfflineOption(true)
        }, 30000)

        try {
            // Filter comprehensive data based on user selections
            const filteredData = {
                activity: comprehensiveData.activity,
                photos: dataSelection.includePhotos
                    ? comprehensiveData.photos?.filter((p: any) =>
                        dataSelection.selectedPhotoIds.includes(p.unique_id)
                    )
                    : [],
                comments: dataSelection.includeComments ? comprehensiveData.comments : [],
                streams: comprehensiveData.streams,
                metadata: comprehensiveData.metadata,
            }

            // Send to AI for generation
            const aiResponse = await fetch('/api/ai-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    activityId: activity.id,
                    comprehensiveData: filteredData,
                    pageCount: dataSelection.pageCount,
                    dataSelection,
                }),
            })

            if (!aiResponse.ok) {
                throw new Error('Failed to generate AI layout')
            }

            const result = await aiResponse.json()

            clearTimeout(offlineTimer)
            setAiResult(result)
            setSuccess(true)
            setLoading(false)

            console.log('AI Generation Result:', result)
        } catch (err) {
            clearTimeout(offlineTimer)
            const errorMessage = err instanceof Error ? err.message : 'An error occurred'
            console.error('AI Generation Error:', err)
            setError(errorMessage)
            setLoading(false)
        }
    }

    const handleContinueOffline = () => {
        // For POC, just show success message
        // In production, this would trigger a background job and email notification
        setLoading(false)
        setSuccess(true)
        setError(null)
        alert('Your AI layout will be generated in the background. We&apos;ll email you when it&apos;s ready!')
    }

    const handleTryAgain = () => {
        setSuccess(false)
        setError(null)
        handleGenerate()
    }

    // Format date for display
    const localDateStr = activity.start_date_local.replace('Z', '')
    const localDate = new Date(localDateStr)
    const dateString = localDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">AI-Generated Race Layout</h2>
                            <p className="text-orange-100 text-sm">Powered by Google Gemini</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:text-orange-100 transition-colors"
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
                    {/* Activity Details */}
                    <div className="bg-stone-50 rounded-xl p-4 mb-6">
                        <h3 className="font-bold text-lg text-stone-800 mb-2">{activity.name}</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm text-stone-600">
                            <div>
                                <span className="block text-xs text-stone-400 uppercase tracking-wide">Date</span>
                                <span className="font-semibold">{dateString}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-stone-400 uppercase tracking-wide">Distance</span>
                                <span className="font-semibold">{(activity.distance / 1000).toFixed(2)} km</span>
                            </div>
                            <div>
                                <span className="block text-xs text-stone-400 uppercase tracking-wide">Time</span>
                                <span className="font-semibold">{Math.floor(activity.moving_time / 3600)}h {Math.floor((activity.moving_time % 3600) / 60)}m</span>
                            </div>
                            <div>
                                <span className="block text-xs text-stone-400 uppercase tracking-wide">Elevation</span>
                                <span className="font-semibold">{activity.total_elevation_gain} m</span>
                            </div>
                        </div>
                    </div>

                    {/* Configuration Section - Only show when configuring */}
                    {configuring && !loading && !success && (
                        <div className="space-y-4 mb-6">
                            {/* Loading State for Data Fetch */}
                            {fetchingData && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                    <p className="text-sm text-blue-700">Loading activity data...</p>
                                </div>
                            )}

                            {/* Configuration Options */}
                            {!fetchingData && comprehensiveData && (
                                <>
                                    {/* Page Count Selector */}
                                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                                        <label className="block text-sm font-semibold text-stone-800 mb-3">
                                            How many pages?
                                        </label>
                                        <div className="flex gap-3">
                                            {([1, 2, 3] as const).map((count) => (
                                                <button
                                                    key={count}
                                                    onClick={() => setDataSelection(prev => ({ ...prev, pageCount: count }))}
                                                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all ${dataSelection.pageCount === count
                                                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                                                        }`}
                                                >
                                                    {count} Page{count > 1 ? 's' : ''}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Data Elements Selection */}
                                    <div className="bg-white border border-stone-200 rounded-lg p-4">
                                        <label className="block text-sm font-semibold text-stone-800 mb-3">
                                            What data should the AI consider?
                                        </label>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includePhotos}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includePhotos: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">
                                                    Photos ({comprehensiveData.photos?.length || 0} available)
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includeComments}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includeComments: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">
                                                    Comments ({comprehensiveData.comments?.length || 0} available)
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includeSplits}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includeSplits: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">Splits & Pacing Data</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includeLaps}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includeLaps: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">Laps</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includeBestEfforts}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includeBestEfforts: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">Best Efforts</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-stone-50 p-2 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={dataSelection.includeElevation}
                                                    onChange={(e) => setDataSelection(prev => ({ ...prev, includeElevation: e.target.checked }))}
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                                />
                                                <span className="text-sm text-stone-700">Elevation Profile</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Photo Selection Grid */}
                                    {dataSelection.includePhotos && comprehensiveData.photos && comprehensiveData.photos.length > 0 && (
                                        <div className="bg-white border border-stone-200 rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="block text-sm font-semibold text-stone-800">
                                                    Select Photos ({dataSelection.selectedPhotoIds.length} of {comprehensiveData.photos.length})
                                                </label>
                                                <button
                                                    onClick={() => {
                                                        const allSelected = dataSelection.selectedPhotoIds.length === comprehensiveData.photos.length
                                                        setDataSelection(prev => ({
                                                            ...prev,
                                                            selectedPhotoIds: allSelected ? [] : comprehensiveData.photos.map((p: any) => p.unique_id)
                                                        }))
                                                    }}
                                                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                                                >
                                                    {dataSelection.selectedPhotoIds.length === comprehensiveData.photos.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                                                {comprehensiveData.photos.map((photo: any, index: number) => {
                                                    const isSelected = dataSelection.selectedPhotoIds.includes(photo.unique_id)
                                                    // Strava returns urls with keys like "5000", "600", etc.
                                                    const photoUrls = photo.urls || {}
                                                    const rawUrl = photoUrls['600'] || photoUrls['5000'] || photoUrls['100'] || Object.values(photoUrls)[0]
                                                    const thumbnailUrl = rawUrl ? `/api/proxy-image?url=${encodeURIComponent(rawUrl as string)}` : ''

                                                    // Debug logging
                                                    if (index === 0) {
                                                        console.log('RENDERING PHOTO:', {
                                                            index,
                                                            unique_id: photo.unique_id,
                                                            availableKeys: Object.keys(photoUrls),
                                                            rawUrl,
                                                            thumbnailUrl: thumbnailUrl.substring(0, 100) + '...',
                                                            hasUrl: !!thumbnailUrl
                                                        })
                                                    }

                                                    return (
                                                        <div
                                                            key={photo.unique_id}
                                                            onClick={() => {
                                                                setDataSelection(prev => ({
                                                                    ...prev,
                                                                    selectedPhotoIds: isSelected
                                                                        ? prev.selectedPhotoIds.filter(id => id !== photo.unique_id)
                                                                        : [...prev.selectedPhotoIds, photo.unique_id]
                                                                }))
                                                            }}
                                                            className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${isSelected
                                                                ? 'border-orange-500 ring-2 ring-orange-200'
                                                                : 'border-stone-200 hover:border-stone-300'
                                                                }`}
                                                        >
                                                            {thumbnailUrl ? (
                                                                <img
                                                                    src={thumbnailUrl}
                                                                    alt={photo.caption || 'Activity photo'}
                                                                    className="w-full h-full object-cover absolute inset-0"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400 text-xs absolute inset-0">
                                                                    No URL
                                                                </div>
                                                            )}
                                                            {isSelected && (
                                                                <div className="absolute top-2 right-2 bg-orange-600 rounded-full p-1 shadow-lg">
                                                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* Status Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start">
                                <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h4 className="font-semibold text-red-800">Error</h4>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {success && aiResult && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                            <div className="flex items-start">
                                <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <h4 className="font-semibold text-green-800 mb-2">AI Layout Generated!</h4>

                                    {/* Success State - Show AI Result */}
                                    <div className="space-y-4">
                                        {/* Debug: Show Raw AI Output */}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <details>
                                                <summary className="text-sm font-semibold text-blue-900 cursor-pointer">🔍 Debug: AI Response (Click to expand)</summary>
                                                <pre className="mt-2 text-xs bg-white p-3 rounded border border-blue-100 overflow-auto max-h-96">
                                                    {JSON.stringify(aiResult.designSpec, null, 2)}
                                                </pre>
                                            </details>
                                        </div>

                                        {/* Layout & Theme */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-1">Layout</span>
                                                <span className="text-sm font-semibold text-stone-900">{aiResult.designSpec?.layout || 'Custom Design'}</span>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-1">Theme</span>
                                                <span className="text-sm font-semibold text-stone-900 capitalize">{aiResult.designSpec?.theme || 'N/A'}</span>
                                            </div>
                                        </div>

                                        {/* Fonts */}
                                        {aiResult.designSpec?.fonts && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">Typography</span>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-stone-500">Page Title:</span>
                                                        <span className="ml-1 font-semibold">{aiResult.designSpec.fonts.pageTitle?.family} ({aiResult.designSpec.fonts.pageTitle?.size}pt)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500">Section:</span>
                                                        <span className="ml-1 font-semibold">{aiResult.designSpec.fonts.sectionTitle?.family} ({aiResult.designSpec.fonts.sectionTitle?.size}pt)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500">Body:</span>
                                                        <span className="ml-1">{aiResult.designSpec.fonts.body?.family} ({aiResult.designSpec.fonts.body?.size}pt)</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-stone-500">Accent:</span>
                                                        <span className="ml-1">{aiResult.designSpec.fonts.accent?.family} ({aiResult.designSpec.fonts.accent?.size}pt)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Color Palette */}
                                        {aiResult.designSpec?.colorScheme && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">Color Palette</span>
                                                <div className="flex gap-2">
                                                    {Object.entries(aiResult.designSpec.colorScheme).map(([name, color]: [string, any]) => (
                                                        <div key={name} className="flex-1">
                                                            <div
                                                                className="h-8 rounded border border-stone-200 mb-1"
                                                                style={{ backgroundColor: color }}
                                                            />
                                                            <div className="text-xs text-stone-600 text-center capitalize">{name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Background */}
                                        {aiResult.designSpec?.background && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">Page Background</span>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1">
                                                        <div className="text-xs text-stone-500 mb-1">Type: <span className="font-semibold capitalize">{aiResult.designSpec.background.type}</span></div>
                                                        {aiResult.designSpec.background.type === 'gradient' ? (
                                                            <div className="flex gap-2">
                                                                <div className="flex-1">
                                                                    <div className="h-6 rounded border border-stone-200" style={{ backgroundColor: aiResult.designSpec.background.gradientStart }} />
                                                                    <div className="text-xs text-stone-600 text-center mt-1">Start</div>
                                                                </div>
                                                                <div className="text-stone-400">→</div>
                                                                <div className="flex-1">
                                                                    <div className="h-6 rounded border border-stone-200" style={{ backgroundColor: aiResult.designSpec.background.gradientEnd }} />
                                                                    <div className="text-xs text-stone-600 text-center mt-1">End</div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-6 rounded border border-stone-200" style={{ backgroundColor: aiResult.designSpec.background.color }} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Narrative */}
                                        {aiResult.designSpec?.narrative && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">AI-Generated Narrative</span>
                                                <p className="text-sm text-stone-700 italic leading-relaxed">{aiResult.designSpec.narrative}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setGenerating(true)
                                                    console.log('Generating PDF with AI design spec...')

                                                    const response = await fetch('/api/generate-pdf', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            designSpec: aiResult.designSpec,
                                                            comprehensiveData,
                                                            pageCount: dataSelection.pageCount,
                                                            activityId: activity.id
                                                        })
                                                    })

                                                    if (!response.ok) {
                                                        const error = await response.json()
                                                        throw new Error(error.details || 'PDF generation failed')
                                                    }

                                                    const blob = await response.blob()
                                                    const url = URL.createObjectURL(blob)
                                                    window.open(url, '_blank')

                                                    console.log('PDF generated and opened successfully')
                                                } catch (error) {
                                                    console.error('PDF generation error:', error)
                                                    alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'))
                                                } finally {
                                                    setGenerating(false)
                                                }
                                            }}
                                            disabled={generating}
                                            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {generating ? 'Generating PDF...' : 'Generate & View PDF'}
                                        </button>
                                        <button
                                            onClick={handleTryAgain}
                                            className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors text-sm font-semibold"
                                        >
                                            Generate Again
                                        </button>
                                        <button
                                            onClick={onClose}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {loading && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                            <div className="flex items-center justify-center mb-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                            </div>
                            <p className="text-center text-blue-800 font-semibold mb-2">Generating your AI layout...</p>
                            <p className="text-center text-sm text-blue-600">
                                Gathering activity data, photos, and creating a custom design
                            </p>

                            {showOfflineOption && (
                                <div className="mt-4 pt-4 border-t border-blue-200">
                                    <p className="text-sm text-blue-700 mb-3 text-center">
                                        This is taking longer than expected. You can continue working and we&apos;ll email you when it&apos;s ready.
                                    </p>
                                    <button
                                        onClick={handleContinueOffline}
                                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                                    >
                                        Continue Offline
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons - Only show during configuration */}
                    {configuring && !loading && !success && (
                        <div className="space-y-3">
                            <button
                                onClick={handleGenerate}
                                disabled={fetchingData || !comprehensiveData}
                                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                Generate AI Layout
                            </button>

                            <div className="bg-stone-50 rounded-lg p-4">
                                <h4 className="font-semibold text-stone-800 mb-2 text-sm">What happens next?</h4>
                                <ul className="text-xs text-stone-600 space-y-1">
                                    <li>• AI analyzes your selected data and {dataSelection.pageCount} page layout</li>
                                    <li>• Generates custom color palette and theme</li>
                                    <li>• Creates personalized narrative and design</li>
                                    <li>• {dataSelection.selectedPhotoIds.length} photo(s) will be considered</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
