'use client'

import { useState, useEffect, useCallback } from 'react'
import { StravaActivity } from '@/lib/strava'

interface PDFGenerationModalProps {
    activity: StravaActivity
    isOpen: boolean
    onClose: () => void
}

interface ComprehensiveActivityData {
    activity: StravaActivity
    photos?: Array<{
        unique_id: string
        urls?: Record<string, string>
        caption?: string
    }>
    comments?: Array<unknown>
    streams?: Record<string, unknown>
    metadata?: unknown
}

interface DataSelection {
    selectedTemplate: 'race_1p' | 'race_2p' | 'race_1p_scrapbook' | 'ai-generated'
    pageCount: 1 | 2 | 3
    includePhotos: boolean
    selectedPhotoIds: string[]
    includeComments: boolean
    includeSplits: boolean
    includeLaps: boolean
    includeBestEfforts: boolean
    includeElevation: boolean
}

export default function PDFGenerationModal({ activity, isOpen, onClose }: PDFGenerationModalProps) {
    const [fetchingData, setFetchingData] = useState(false)
    const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveActivityData | null>(null)
    const [dataSelection, setDataSelection] = useState<DataSelection>({
        selectedTemplate: 'race_2p',
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
    const fetchComprehensiveData = useCallback(async () => {
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
                    selectedPhotoIds: data.photos.map((p: { unique_id: string }) => p.unique_id)
                }))
            }
        } catch (err) {
            console.error('Failed to fetch comprehensive data:', err)
        } finally {
            setFetchingData(false)
        }
    }, [activity.id])

    useEffect(() => {
        if (isOpen && !comprehensiveData) {
            fetchComprehensiveData()
        }
    }, [isOpen, comprehensiveData, fetchComprehensiveData])

    if (!isOpen) return null

    const handleGeneratePreview = () => {
        // For AI-generated, redirect to AI modal workflow
        if (dataSelection.selectedTemplate === 'ai-generated') {
            // TODO: Trigger AI generation workflow
            console.log('AI generation not yet implemented in unified modal')
            return
        }

        // Build URL with user selections as query parameters
        const template = dataSelection.selectedTemplate
        const params = new URLSearchParams({
            includePhotos: dataSelection.includePhotos.toString(),
            includeComments: dataSelection.includeComments.toString(),
            includeSplits: dataSelection.includeSplits.toString(),
            includeLaps: dataSelection.includeLaps.toString(),
            includeBestEfforts: dataSelection.includeBestEfforts.toString(),
            includeElevation: dataSelection.includeElevation.toString(),
            pageCount: dataSelection.pageCount.toString(),
        })

        // Add selected photo IDs if photos are included
        if (dataSelection.includePhotos && dataSelection.selectedPhotoIds.length > 0) {
            params.append('photoIds', dataSelection.selectedPhotoIds.join(','))
        }

        window.open(`/preview/${template}/${activity.id}?${params.toString()}`, '_blank')
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
                            <h2 className="text-2xl font-bold mb-2">Generate PDF Pages</h2>
                            <p className="text-orange-100 text-sm">Configure your race page layout</p>
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

                    {/* Loading State for Data Fetch */}
                    {fetchingData && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center mb-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                            <p className="text-sm text-blue-700">Loading activity data...</p>
                        </div>
                    )}

                    {/* Configuration Options */}
                    {!fetchingData && comprehensiveData && (
                        <div className="space-y-4 mb-6">
                            {/* Template Selector */}
                            <div className="bg-white border border-stone-200 rounded-lg p-4">
                                <label className="block text-sm font-semibold text-stone-800 mb-3">
                                    Select Template
                                </label>
                                <select
                                    value={dataSelection.selectedTemplate}
                                    onChange={(e) => setDataSelection(prev => ({
                                        ...prev,
                                        selectedTemplate: e.target.value as DataSelection['selectedTemplate']
                                    }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="race_1p">Race (1 Page)</option>
                                    <option value="race_2p">Race (2 Pages)</option>
                                    <option value="race_1p_scrapbook">Race (1 Page - Scrapbook)</option>
                                    <option value="ai-generated">AI-Generated ✨</option>
                                </select>
                            </div>

                            {/* Page Count Selector - Only show for non-AI templates */}
                            {dataSelection.selectedTemplate !== 'ai-generated' && (
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
                            )}

                            {/* Data Elements Selection */}
                            <div className="bg-white border border-stone-200 rounded-lg p-4">
                                <label className="block text-sm font-semibold text-stone-800 mb-3">
                                    What data should be included?
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
                                            Select Photos ({dataSelection.selectedPhotoIds.length} of {comprehensiveData.photos?.length || 0})
                                        </label>
                                        <button
                                            onClick={() => {
                                                const allSelected = dataSelection.selectedPhotoIds.length === (comprehensiveData.photos?.length || 0)
                                                setDataSelection(prev => ({
                                                    ...prev,
                                                    selectedPhotoIds: allSelected ? [] : (comprehensiveData.photos?.map((p: { unique_id: string }) => p.unique_id) || [])
                                                }))
                                            }}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-semibold"
                                        >
                                            {dataSelection.selectedPhotoIds.length === (comprehensiveData.photos?.length || 0) ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                                        {comprehensiveData.photos && comprehensiveData.photos.map((photo: { unique_id: string; urls?: Record<string, string>; caption?: string }) => {
                                            const isSelected = dataSelection.selectedPhotoIds.includes(photo.unique_id)
                                            const photoUrls = photo.urls || {}
                                            const rawUrl = photoUrls['600'] || photoUrls['5000'] || photoUrls['100'] || Object.values(photoUrls)[0]
                                            const rawUrlString = rawUrl ? String(rawUrl) : ''
                                            const thumbnailUrl = rawUrlString ? `/api/proxy-image?url=${encodeURIComponent(rawUrlString)}` : ''

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
                                                        // eslint-disable-next-line @next/next/no-img-element
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
                        </div>
                    )}

                    {/* Action Buttons */}
                    {!fetchingData && comprehensiveData && (
                        <div className="space-y-3">
                            <button
                                onClick={handleGeneratePreview}
                                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                Generate Preview
                            </button>

                            <div className="bg-stone-50 rounded-lg p-4">
                                <h4 className="font-semibold text-stone-800 mb-2 text-sm">What happens next?</h4>
                                <ul className="text-xs text-stone-600 space-y-1">
                                    <li>• Your PDF will open in a new tab</li>
                                    <li>• You can download or print from there</li>
                                    <li>• Come back here to try different templates or configurations</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
