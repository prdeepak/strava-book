'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { RaceSection } from '@/components/templates/RaceSection'
import { Race_1p } from '@/components/templates/Race_1p'
import ScrapbookPDF from '@/components/templates/race_1p_scrapbook/race_1p_scrapbook'
import ConcatAllPDF from '@/components/templates/ConcatAllPDF'
import { StravaActivity } from '@/lib/strava'
import { getSingleActivityTemplates } from '@/lib/template-specs/registry'

// Get valid template IDs from registry + concat_all
const validTemplateIds = [...getSingleActivityTemplates().map(t => t.id), 'concat_all']

interface PDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
    template?: string
}

const PDFPreview = ({ activity, mapboxToken, template = 'race_section' }: PDFPreviewProps) => {
    // Validate template exists in registry or is concat_all, fall back to race_section
    const templateId = validTemplateIds.includes(template) ? template : 'race_section'

    if (templateId === 'race_section') {
        return (
            <PDFViewer style={{ width: '100%', height: '100vh' }}>
                <RaceSection activity={activity} mapboxToken={mapboxToken} />
            </PDFViewer>
        )
    }

    if (templateId === 'race_1p') {
        return (
            <PDFViewer style={{ width: '100%', height: '100vh' }}>
                <Race_1p activity={activity} mapboxToken={mapboxToken} />
            </PDFViewer>
        )
    }

    if (templateId === 'race_1p_scrapbook') {
        return (
            <PDFViewer style={{ width: '100%', height: '100vh' }}>
                <ScrapbookPDF activity={activity} mapboxToken={mapboxToken} />
            </PDFViewer>
        )
    }

    if (templateId === 'concat_all') {
        return (
            <PDFViewer style={{ width: '100%', height: '100vh' }}>
                <ConcatAllPDF activity={activity} mapboxToken={mapboxToken} />
            </PDFViewer>
        )
    }

    // Default to race_section
    return (
        <PDFViewer style={{ width: '100%', height: '100vh' }}>
            <RaceSection activity={activity} mapboxToken={mapboxToken} />
        </PDFViewer>
    )
}

export default PDFPreview
