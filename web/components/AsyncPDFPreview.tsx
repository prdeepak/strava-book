'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'

interface AsyncPDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
}

// Dynamic import with SSR disabled
const PDFPreview = dynamic(() => import('./PDFPreview'), {
    ssr: false,
    loading: () => <p>Loading PDF Renderer...</p>
})

export default function AsyncPDFPreview({ activity, mapboxToken }: AsyncPDFPreviewProps) {
    return <PDFPreview activity={activity} mapboxToken={mapboxToken} />
}
