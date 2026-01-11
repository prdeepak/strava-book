'use client'

import { PDFViewer } from '@react-pdf/renderer'
import { Race_2p } from '@/components/templates/Race_2p'
import { Race_1p } from '@/components/templates/Race_1p'
import ScrapbookPDF from '@/components/templates/race_1p_scrapbook/race_1p_scrapbook'
import { StravaActivity } from '@/lib/strava'
import { getSingleActivityTemplates } from '@/lib/template-specs/registry'

// Map template IDs to their React components
// When adding a new template, add its component import above and mapping here
const templateComponents: Record<string, React.ComponentType<{ activity: StravaActivity; mapboxToken?: string }>> = {
    'race_1p': Race_1p,
    'race_2p': Race_2p,
    'race_1p_scrapbook': ScrapbookPDF,
    'ai_race': Race_1p, // AI Race uses Race_1p as base for now
}

// Get valid template IDs from registry
const validTemplateIds = getSingleActivityTemplates().map(t => t.id)

interface PDFPreviewProps {
    activity: StravaActivity
    mapboxToken?: string
    template?: string
}

const PDFPreview = ({ activity, mapboxToken, template = 'race_2p' }: PDFPreviewProps) => {
    // Validate template exists in registry, fall back to race_2p
    const templateId = validTemplateIds.includes(template) ? template : 'race_2p'
    const TemplateComponent = templateComponents[templateId] || Race_2p

    return (
        <PDFViewer style={{ width: '100%', height: '100vh' }}>
            <TemplateComponent activity={activity} mapboxToken={mapboxToken} />
        </PDFViewer>
    )
}

export default PDFPreview
