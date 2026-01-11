import { Document } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { RaceSectionHeroPage } from './RaceSectionHeroPage'
import { RaceSectionStatsPage } from './RaceSectionStatsPage'
import { RaceSectionDescriptionPage } from './RaceSectionDescriptionPage'
import { RaceSectionPhotosPage, getPhotoPageCount } from './RaceSectionPhotosPage'
import { RaceSectionCommentsPage } from './RaceSectionCommentsPage'

// Available variants for RaceSection template
export type RaceSectionVariant =
    | 'compact'   // 2 pages: hero + stats/map
    | 'standard'  // 4 pages: hero, stats/map, photos, splits
    | 'full'      // 6+ pages: complete race story
    | 'minimal'   // 2 pages: map + stats (no hero photo)

export interface RaceSectionProps {
    activity: StravaActivity
    format?: BookFormat
    theme?: BookTheme
    mapboxToken?: string
    highlightLabel?: string
    variant?: RaceSectionVariant
}

/**
 * Render pages for the 'compact' variant (2 pages)
 * - Hero photo with stats overlay
 * - Stats/map page
 */
const renderCompactPages = (props: Required<Omit<RaceSectionProps, 'variant'>>) => {
    const { activity, format, theme, mapboxToken, highlightLabel } = props
    return (
        <>
            <RaceSectionHeroPage
                activity={activity}
                format={format}
                theme={theme}
                highlightLabel={highlightLabel}
            />
            <RaceSectionStatsPage
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />
        </>
    )
}

/**
 * Render pages for the 'minimal' variant (2 pages)
 * - Stats/map page (no hero photo)
 * - Description page (if description exists)
 */
const renderMinimalPages = (props: Required<Omit<RaceSectionProps, 'variant'>>) => {
    const { activity, format, theme, mapboxToken } = props
    return (
        <>
            <RaceSectionStatsPage
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />
            {activity.description && (
                <RaceSectionDescriptionPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            )}
        </>
    )
}

/**
 * Render pages for the 'standard' variant (4 pages)
 * - Hero photo with stats overlay
 * - Stats/map page
 * - Photos page
 * - Description or comments page
 */
const renderStandardPages = (props: Required<Omit<RaceSectionProps, 'variant'>>) => {
    const { activity, format, theme, mapboxToken, highlightLabel } = props
    const hasPhotos = getPhotoPageCount(activity) > 0
    const hasDescription = !!activity.description
    const hasComments = (activity.comprehensiveData?.comments?.length || activity.comments?.length || 0) > 0

    return (
        <>
            <RaceSectionHeroPage
                activity={activity}
                format={format}
                theme={theme}
                highlightLabel={highlightLabel}
            />
            <RaceSectionStatsPage
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />
            {hasPhotos && (
                <RaceSectionPhotosPage
                    activity={activity}
                    format={format}
                    theme={theme}
                    pageIndex={0}
                />
            )}
            {hasDescription ? (
                <RaceSectionDescriptionPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            ) : hasComments ? (
                <RaceSectionCommentsPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            ) : null}
        </>
    )
}

/**
 * Render pages for the 'full' variant (6+ pages)
 * Prioritizes emotionally-compelling content first:
 * 1. Hero photo with stats overlay
 * 2. Description/narrative page (the athlete's story)
 * 3. Comments & kudos page (community support)
 * 4. Stats/map page
 * 5+ Photo gallery pages (as many as needed)
 */
const renderFullPages = (props: Required<Omit<RaceSectionProps, 'variant'>>) => {
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

            {/* 2. Description page - the athlete's story (emotionally compelling) */}
            {hasDescription && (
                <RaceSectionDescriptionPage
                    activity={activity}
                    format={format}
                    theme={theme}
                />
            )}

            {/* 3. Comments & kudos page - community support (emotionally compelling) */}
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
 * Returns a Document with pages based on the variant
 */
export const RaceSection = ({
    activity,
    format = FORMATS['10x10'],
    theme = DEFAULT_THEME,
    mapboxToken,
    highlightLabel,
    variant = 'compact'
}: RaceSectionProps) => {
    console.log(`[RaceSection] Rendering variant: ${variant}`)

    const props = { activity, format, theme, mapboxToken: mapboxToken || '', highlightLabel: highlightLabel || '' }

    return (
        <Document>
            {variant === 'full' && renderFullPages(props)}
            {variant === 'standard' && renderStandardPages(props)}
            {variant === 'minimal' && renderMinimalPages(props)}
            {variant === 'compact' && renderCompactPages(props)}
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
    variant = 'compact'
}: RaceSectionProps) => {
    console.log(`[RaceSectionPages] Rendering variant: ${variant}`)

    const props = { activity, format, theme, mapboxToken: mapboxToken || '', highlightLabel: highlightLabel || '' }

    return (
        <>
            {variant === 'full' && renderFullPages(props)}
            {variant === 'standard' && renderStandardPages(props)}
            {variant === 'minimal' && renderMinimalPages(props)}
            {variant === 'compact' && renderCompactPages(props)}
        </>
    )
}

// Legacy exports for backwards compatibility during migration
export type Race2pVariant = RaceSectionVariant
export const Race_2p = RaceSection
export const Race_2pSpread = RaceSection
export const Race_2pSpreadPages = RaceSectionPages
