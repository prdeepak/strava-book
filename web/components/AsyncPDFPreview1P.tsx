'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'

interface AsyncPDFPreview1PProps {
    activity: StravaActivity
    mapboxToken?: string
}

// Dynamic import with SSR disabled
const PDFPreview1P = dynamic(() => import('@/components/PDFPreview1P'), {
    ssr: false,
    loading: () => <p>Loading PDF Renderer...</p>
})

export default function AsyncPDFPreview1P({ activity, mapboxToken }: AsyncPDFPreview1PProps) {
    return <PDFPreview1P activity={activity} mapboxToken={mapboxToken} />
}
