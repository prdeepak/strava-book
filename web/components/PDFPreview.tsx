'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { Race_2p } from '@/components/templates/Race_2p'
import { Race_1p } from '@/components/templates/Race_1p'
import { StravaActivity } from '@/lib/strava'

type RaceTemplate = 'race_1p' | 'race_2p'

interface PDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
    template?: RaceTemplate
}

const PDFPreview = ({ activity, mapboxToken, template = 'race_2p' }: PDFPreviewProps) => {
    const TemplateComponent = template === 'race_1p' ? Race_1p : Race_2p

    return (
        <PDFViewer style={{ width: '100%', height: '100vh' }}>
            <TemplateComponent activity={activity} mapboxToken={mapboxToken} />
        </PDFViewer>
    )
}

export default PDFPreview
