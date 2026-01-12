'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

interface FetchResult {
    activities: unknown[]
    metadata: {
        totalCount: number
        dateRange: { after: string; before: string }
        fetchedAt: string
        detailsIncluded: boolean
        withPhotos?: number
        withComments?: number
        races?: number
    }
}

export default function FetchFixturesPage() {
    const { data: session, status } = useSession()
    const [loading, setLoading] = useState(false)
    const [progress, setProgress] = useState('')
    const [result, setResult] = useState<FetchResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Date range for Comrades build-up
    const afterDate = '2024-07-01'
    const beforeDate = '2025-06-15'

    const fetchActivities = async (skipDetails: boolean = false) => {
        setLoading(true)
        setError(null)
        setProgress(skipDetails ? 'Fetching activity summaries...' : 'Fetching all activities with full details (this may take several minutes)...')

        try {
            const params = new URLSearchParams({
                after: afterDate,
                before: beforeDate,
            })
            if (skipDetails) {
                params.set('skipDetails', 'true')
            }

            const response = await fetch(`/api/fetch-all-activities?${params}`)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`)
            }

            const data = await response.json()
            setResult(data)
            setProgress(`Done! Fetched ${data.metadata.totalCount} activities.`)

        } catch (err) {
            setError(String(err))
            setProgress('')
        } finally {
            setLoading(false)
        }
    }

    const downloadJSON = () => {
        if (!result) return

        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `strava-fixtures-${afterDate}-to-${beforeDate}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (status === 'loading') {
        return <div className="p-8">Loading session...</div>
    }

    if (!session) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold mb-4">Fetch Strava Fixtures</h1>
                <p className="text-red-600">You must be logged in to fetch activities.</p>
                <Link href="/" className="text-blue-600 underline">Go to home page to log in</Link>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Fetch Strava Fixtures</h1>

            <div className="bg-gray-100 p-4 rounded mb-6">
                <p className="font-medium">Date Range:</p>
                <p className="text-gray-600">{afterDate} to {beforeDate}</p>
                <p className="text-sm text-gray-500 mt-2">
                    (Comrades 2025 build-up period)
                </p>
            </div>

            <div className="space-x-4 mb-6">
                <button
                    onClick={() => fetchActivities(true)}
                    disabled={loading}
                    className="bg-gray-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-gray-700"
                >
                    {loading ? 'Loading...' : 'Quick Fetch (summaries only)'}
                </button>

                <button
                    onClick={() => fetchActivities(false)}
                    disabled={loading}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-blue-700"
                >
                    {loading ? 'Loading...' : 'Full Fetch (with photos, comments, streams)'}
                </button>
            </div>

            {progress && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded mb-6">
                    <p>{progress}</p>
                    {loading && (
                        <p className="text-sm text-gray-600 mt-2">
                            Full fetch may take 2-5 minutes for ~300 activities. Please keep this tab open.
                        </p>
                    )}
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded mb-6 text-red-700">
                    <p className="font-medium">Error:</p>
                    <p>{error}</p>
                </div>
            )}

            {result && (
                <div className="border rounded p-6">
                    <h2 className="text-xl font-bold mb-4">Results</h2>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-50 p-3 rounded">
                            <p className="text-sm text-gray-600">Total Activities</p>
                            <p className="text-2xl font-bold">{result.metadata.totalCount}</p>
                        </div>
                        {result.metadata.races !== undefined && (
                            <div className="bg-orange-50 p-3 rounded">
                                <p className="text-sm text-gray-600">Races</p>
                                <p className="text-2xl font-bold">{result.metadata.races}</p>
                            </div>
                        )}
                        {result.metadata.withPhotos !== undefined && (
                            <div className="bg-green-50 p-3 rounded">
                                <p className="text-sm text-gray-600">With Photos</p>
                                <p className="text-2xl font-bold">{result.metadata.withPhotos}</p>
                            </div>
                        )}
                        {result.metadata.withComments !== undefined && (
                            <div className="bg-blue-50 p-3 rounded">
                                <p className="text-sm text-gray-600">With Comments</p>
                                <p className="text-2xl font-bold">{result.metadata.withComments}</p>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={downloadJSON}
                        className="bg-green-600 text-white px-6 py-3 rounded font-medium hover:bg-green-700"
                    >
                        Download JSON ({(JSON.stringify(result).length / 1024 / 1024).toFixed(2)} MB)
                    </button>

                    <div className="mt-6">
                        <h3 className="font-medium mb-2">Activity Types:</h3>
                        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40">
                            {JSON.stringify(
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                result.activities.reduce((acc: Record<string, number>, a: any) => {
                                    acc[a.type] = (acc[a.type] || 0) + 1
                                    return acc
                                }, {}),
                                null,
                                2
                            )}
                        </pre>
                    </div>

                    <details className="mt-4">
                        <summary className="cursor-pointer text-blue-600">Preview first 5 activities</summary>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-96 mt-2">
                            {JSON.stringify(result.activities.slice(0, 5), null, 2)}
                        </pre>
                    </details>
                </div>
            )}
        </div>
    )
}
