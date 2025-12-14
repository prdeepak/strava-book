'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { RacePage } from '@/components/templates/RacePage' // Assuming RacePage is renamed to RacePageSpread or RacePageSpread is a new component
import { StravaActivity } from '@/lib/strava'

interface PDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
}

const PDFPreview = ({ activity, mapboxToken }: PDFPreviewProps) => (
    <PDFViewer style={{ width: '100%', height: '100vh' }}>
        <RacePage activity={activity} mapboxToken={mapboxToken} />
    </PDFViewer>
)

export default PDFPreview
