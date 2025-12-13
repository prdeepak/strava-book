'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { RacePage } from '@/components/templates/RacePage'
import { StravaActivity } from '@/lib/strava'

export default function PDFPreview({ activity }: { activity: StravaActivity }) {
    return (
        <div className="w-full h-screen">
            <PDFViewer style={{ width: '100%', height: '100%' }}>
                <RacePage activity={activity} />
            </PDFViewer>
        </div>
    )
}
