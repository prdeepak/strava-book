import { Document } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { RaceSectionHeroPage } from './RaceSectionHeroPage'
import { RaceSectionStatsPage } from './RaceSectionStatsPage'
import { RaceSectionDescriptionPage } from './RaceSectionDescriptionPage'
import { RaceSectionPhotosPage, getPhotoPageCount } from './RaceSectionPhotosPage'
import { RaceSectionCommentsPage } from './RaceSectionCommentsPage'

export interface RaceSectionProps {
    activity: StravaActivity
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
    highlightLabel?: string
}

/**
 * Render race section pages
 *
 * Page order prioritizes emotionally-compelling content:
 * 1. Hero photo with stats overlay (always)
 * 2. Description/narrative page (if exists)
 * 3. Comments & kudos page (if exists)
 * 4. Stats/map page (always)
 * 5+ Photo gallery pages (if photos exist)
 *
 * Pages are conditionally rendered based on available content.
 */
const renderPages = (props: {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel: string
}) => {
    const { activity, format, theme, mapboxToken, highlightLabel } = props
    const photoPageCount = getPhotoPageCount(activity)
    const hasDescription = !!activity.description
    const hasComments = (activity.comprehensiveData?.comments?.length || activity.comments?.length || 0) > 0 ||
        (activity.kudos_count || 0) > 0

    return (
        <>
            {/* 1. Hero page - dramatic visual impact */}
            <RaceSectionHeroPage
                activity={activity}
                format={format}
                theme={theme}
                highlightLabel={highlightLabel}
            />

            {/* 2. Description page - the athlete's story */}
            {hasDescription && (
                <RaceSectionDescriptionPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            )}

            {/* 3. Comments & kudos page - community support */}
            {hasComments && (
                <RaceSectionCommentsPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            )}

            {/* 4. Stats/map page - race details */}
            <RaceSectionStatsPage
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />

            {/* 5+ Photo gallery pages - as many as needed */}
            {Array.from({ length: photoPageCount }).map((_, i) => (
                <RaceSectionPhotosPage
                    key={`photos-${i}`}
                    activity={activity}
                    format={format}
                    theme={theme}
                    pageIndex={i}
                />
            ))}
        </>
    )
}

/**
 * RaceSection - Multi-page race section component
 * Returns a Document with pages for a race activity
 */
export const RaceSection = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionProps) => {
    const props = {
        activity,
        format,
        theme,
        mapboxToken: mapboxToken || '',
        highlightLabel: highlightLabel || ''
    }

    return (
        <Document>
            {renderPages(props)}
        </Document>
    )
}

/**
 * RaceSectionPages - Returns just the pages without Document wrapper
 * Use this when embedding inside another Document (like BookDocument)
 */
export const RaceSectionPages = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
}: RaceSectionProps) => {
    const props = {
        activity,
        format,
        theme,
        mapboxToken: mapboxToken || '',
        highlightLabel: highlightLabel || ''
    }

    return renderPages(props)
}

// Legacy exports for backwards compatibility
export type RaceSectionVariant = 'auto' | 'full'
export type Race2pVariant = RaceSectionVariant
export const Race_2p = RaceSection
export const Race_2pSpread = RaceSection
export const Race_2pSpreadPages = RaceSectionPages
