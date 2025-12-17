'use client'

import { useState } from 'react'
import { StravaActivity } from '@/lib/strava'

interface AIGenerationModalProps {
    activity: StravaActivity
    isOpen: boolean
    onClose: () => void
}

export default function AIGenerationModal({ activity, isOpen, onClose }: AIGenerationModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showOfflineOption, setShowOfflineOption] = useState(false)
    const [aiResult, setAiResult] = useState<any>(null)

    if (!isOpen) return null

    const handleGenerate = async () => {
        setLoading(true)
        setError(null)
        setSuccess(false)
        setShowOfflineOption(false)

        // Show offline option after 30 seconds
        const offlineTimer = setTimeout(() => {
            setShowOfflineOption(true)
        }, 30000)

        try {
            // Step 1: Gather comprehensive data
            const dataResponse = await fetch(`/api/comprehensive-activity-data?activityId=${activity.id}`)

            if (!dataResponse.ok) {
                throw new Error('Failed to gather activity data')
            }

            const comprehensiveData = await dataResponse.json()

            // Step 2: Send to AI for generation (mock for now)
            const aiResponse = await fetch('/api/ai-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    activityId: activity.id,
                    comprehensiveData,
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

                                    {/* Design Spec Display */}
                                    <div className="space-y-3 mb-4">
                                        {/* Layout & Theme */}
                                        <div className="bg-white rounded-lg p-3 border border-green-200">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <span className="text-xs text-stone-500 uppercase tracking-wide block mb-1">Layout</span>
                                                    <span className="font-semibold text-stone-800 capitalize">{aiResult.designSpec?.layout || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-stone-500 uppercase tracking-wide block mb-1">Theme</span>
                                                    <span className="font-semibold text-stone-800 capitalize">{aiResult.designSpec?.theme || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Color Palette */}
                                        {aiResult.designSpec?.colorPalette && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">Color Palette</span>
                                                <div className="flex gap-2">
                                                    {Object.entries(aiResult.designSpec.colorPalette).map(([name, color]: [string, any]) => (
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

                                        {/* Narrative */}
                                        {aiResult.designSpec?.narrative && (
                                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                                <span className="text-xs text-stone-500 uppercase tracking-wide block mb-2">AI-Generated Narrative</span>
                                                <h5 className="font-bold text-stone-900 mb-1">{aiResult.designSpec.narrative.title}</h5>
                                                <p className="text-sm text-stone-700 italic mb-2">{aiResult.designSpec.narrative.subtitle}</p>
                                                <p className="text-xs text-stone-600 leading-relaxed">{aiResult.designSpec.narrative.story}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
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

                    {/* Action Buttons */}
                    {!loading && !success && (
                        <div className="space-y-3">
                            <button
                                onClick={handleGenerate}
                                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                Generate AI Layout
                            </button>

                            <div className="bg-stone-50 rounded-lg p-4">
                                <h4 className="font-semibold text-stone-800 mb-2 text-sm">What happens next?</h4>
                                <ul className="text-xs text-stone-600 space-y-1">
                                    <li>• Gather all activity data, photos, and comments from Strava</li>
                                    <li>• Analyze your race details, location, and performance</li>
                                    <li>• Generate a custom layout designed specifically for this activity</li>
                                    <li>• Create a unique narrative based on your achievement</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
