import { Document } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { Race_1pPages, Race1pVariant } from './Race_1p'
import { Race_2pSpreadPages } from './RaceSection'
import { ScrapbookPDFPages } from './race_1p_scrapbook/race_1p_scrapbook'

/**
 * ConcatAllPDF - Generates all template variants into a single concatenated PDF
 * Used by the "Concat All" option in the PDF generation dropdown
 */

interface ConcatAllPDFProps {
    activity: StravaActivity
    mapboxToken?: string
    format?: BookFormat
    theme?: BookTheme
}

// All Race_1p variants to include
const race1pVariants: Race1pVariant[] = [
    'photo-hero',
    'map-hero',
    'dual-image',
    'stats-focus',
    'polyline-minimal'
]

export const ConcatAllPDF = ({
    activity,
    mapboxToken,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME
}: ConcatAllPDFProps) => {
    return (
        <Document>
            {/* Race_1p - All variants */}
            {race1pVariants.map(variant => (
                <Race_1pPages
                    key={`race_1p_${variant}`}
                    activity={activity}
                    mapboxToken={mapboxToken}
                    format={format}
                    theme={theme}
                    layoutVariant={variant}
                />
            ))}

            {/* Race_2p - 2-page spread */}
            <Race_2pSpreadPages
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />

            {/* Scrapbook - single page */}
            <ScrapbookPDFPages
                activity={activity}
                mapboxToken={mapboxToken}
            />
        </Document>
    )
}

export default ConcatAllPDF
