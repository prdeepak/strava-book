import { Document } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS, RaceSectionVariant } from '@/lib/book-types'
import { RaceSectionHeroPage } from './RaceSectionHeroPage'
import { RaceSectionStatsPage } from './RaceSectionStatsPage'
import { RaceSectionDescriptionPage } from './RaceSectionDescriptionPage'
import { RaceSectionPhotosPage, getPhotoPageCount } from './RaceSectionPhotosPage'
import { RaceSectionCommentsPage } from './RaceSectionCommentsPage'
import { RaceSectionMapHeroPages } from './RaceSectionMapHero'
import { RaceSectionPhotoEssayPages } from './RaceSectionPhotoEssay'
import { RaceSectionStatsForwardPages } from './RaceSectionStatsForward'
import { RaceSectionCompactPages } from './RaceSectionCompact'

export interface RaceSectionProps {
    activity: StravaActivity
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
    highlightLabel?: string
    variant?: RaceSectionVariant
}

/**
 * Render default race section pages (full multi-page treatment)
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
const renderDefaultPages = (props: {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel: string
}) => {
    const { activity, format, theme, mapboxToken, highlightLabel } = props
    const photoPageCount = getPhotoPageCount(activity)
    const hasDescription = !!activity.description
    const commentCount = activity.comprehensiveData?.comments?.length || activity.comments?.length || 0
    const hasEnoughComments = commentCount >= 3

    return (
        <>
            {/* 1. Hero page - dramatic visual impact */}
            <RaceSectionHeroPage
                activity={activity}
                format={format}
                theme={theme}
                highlightLabel={highlightLabel}
                mapboxToken={mapboxToken}
            />

            {/* 2. Description page - the athlete's story */}
            {/*    When < 3 comments, inline them here instead of a separate page */}
            {hasDescription && (
                <RaceSectionDescriptionPage
                    activity={activity}
                    format={format}
                    theme={theme}
                    inlineComments={!hasEnoughComments}
                />
            )}

            {/* 3. Comments & kudos page - only when 3+ comments justify a full page */}
            {hasEnoughComments && (
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
 * Route to the appropriate variant renderer based on the variant prop
 */
const renderPages = (props: {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel: string
    variant: RaceSectionVariant
}) => {
    const { variant, ...rest } = props

    switch (variant) {
        case 'map-hero':
            return (
                <RaceSectionMapHeroPages
                    activity={rest.activity}
                    format={rest.format}
                    theme={rest.theme}
                    mapboxToken={rest.mapboxToken}
                    highlightLabel={rest.highlightLabel}
                />
            )
        case 'photo-essay':
            return (
                <RaceSectionPhotoEssayPages
                    activity={rest.activity}
                    format={rest.format}
                    theme={rest.theme}
                    mapboxToken={rest.mapboxToken}
                    highlightLabel={rest.highlightLabel}
                />
            )
        case 'stats-forward':
            return (
                <RaceSectionStatsForwardPages
                    activity={rest.activity}
                    format={rest.format}
                    theme={rest.theme}
                    mapboxToken={rest.mapboxToken}
                    highlightLabel={rest.highlightLabel}
                />
            )
        case 'compact':
            return (
                <RaceSectionCompactPages
                    activity={rest.activity}
                    format={rest.format}
                    theme={rest.theme}
                    mapboxToken={rest.mapboxToken}
                    highlightLabel={rest.highlightLabel}
                />
            )
        case 'default':
        default:
            return renderDefaultPages(rest)
    }
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
    variant = 'default',
}: RaceSectionProps) => {
    const props = {
        activity,
        format,
        theme,
        mapboxToken: mapboxToken || '',
        highlightLabel: highlightLabel || '',
        variant,
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
    variant = 'default',
}: RaceSectionProps) => {
    const props = {
        activity,
        format,
        theme,
        mapboxToken: mapboxToken || '',
        highlightLabel: highlightLabel || '',
        variant,
    }

    return renderPages(props)
}

// Legacy exports for backwards compatibility
export type Race2pVariant = 'auto' | 'full'
export const Race_2p = RaceSection
export const Race_2pSpread = RaceSection
export const Race_2pSpreadPages = RaceSectionPages
