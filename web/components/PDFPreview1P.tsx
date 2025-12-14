'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { RacePage1P } from '@/components/templates/RacePage1P'
import { StravaActivity } from '@/lib/strava'

interface PDFPreview1PProps {
    activity: StravaActivity
    mapboxToken?: string
}

const PDFPreview1P = ({ activity, mapboxToken }: PDFPreview1PProps) => (
    <PDFViewer style={{ width: '100%', height: '100vh' }}>
        <RacePage1P activity={activity} mapboxToken={mapboxToken} />
    </PDFViewer>
)

export default PDFPreview1P
