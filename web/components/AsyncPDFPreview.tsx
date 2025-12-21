'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'

// Dynamically import PDFPreview to avoid SSR issues with react-pdf

type RaceTemplate = 'race_1p' | 'race_2p' | 'race_1p_scrapbook'

interface AsyncPDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
    template?: RaceTemplate
}

const PDFPreview = dynamic(() => import('./PDFPreview'), {
    ssr: false,
    loading: () => <div>Loading PDF...</div>
})

export default function AsyncPDFPreview({ activity, mapboxToken, template = 'race_2p' }: AsyncPDFPreviewProps) {
    return <PDFPreview activity={activity} mapboxToken={mapboxToken} template={template} />
}
