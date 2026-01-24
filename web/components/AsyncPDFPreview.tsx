'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'

// Dynamically import PDFPreview to avoid SSR issues with react-pdf

interface AsyncPDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
    template?: string
}

const PDFPreview = dynamic(() => import('./PDFPreview'), {
    ssr: false,
    loading: () => <div>Loading PDF...</div>
})

export default function AsyncPDFPreview({ activity, mapboxToken, template = 'race_section' }: AsyncPDFPreviewProps) {
    return <PDFPreview activity={activity} mapboxToken={mapboxToken} template={template} />
}
