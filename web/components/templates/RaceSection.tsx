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
    | 'auto'      // Dynamically choose based on content richness
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
 * Determine the best variant based on content richness
 *
 * Scoring system:
 * - Photos: 1 point each (max 5)
 * - Description: 2 points if exists, +1 if > 200 chars
 * - Comments: 1 point each (max 3)
 * - Kudos: 1 point if > 10, +1 if > 50
 * - Best efforts with PRs: 2 points each (max 6)
 *
 * Thresholds:
 * - 0-2 points: minimal (no hero, just stats)
 * - 3-5 points: compact (hero + stats)
 * - 6-10 points: standard (4 pages)
 * - 11+ points: full (6+ pages)
 */
function determineAutoVariant(activity: StravaActivity): Exclude<RaceSectionVariant, 'auto'> {
    let score = 0

    // Photo scoring
    const photos = activity.comprehensiveData?.photos || activity.allPhotos || []
    const photoCount = photos.length > 0 ? photos.length : (activity.photos?.count || 0)
    score += Math.min(photoCount, 5)

    // Description scoring
    const description = activity.description || ''
    if (description.length > 0) {
        score += 2
        if (description.length > 200) score += 1
    }

    // Comments scoring
    const comments = activity.comprehensiveData?.comments || activity.comments || []
    score += Math.min(comments.length, 3)

    // Kudos scoring
    const kudos = activity.kudos_count || 0
    if (kudos > 10) score += 1
    if (kudos > 50) score += 1

    // PR scoring (best efforts with top-3 rank)
    const bestEfforts = activity.best_efforts || []
    const prCount = bestEfforts.filter(e => e.pr_rank && e.pr_rank <= 3).length
    score += Math.min(prCount * 2, 6)

    console.log(`[RaceSection] Auto variant scoring for "${activity.name}":`, {
        photoCount,
        descriptionLength: description.length,
        commentCount: comments.length,
        kudos,
        prCount,
        totalScore: score
    })

    // Determine variant based on score
    if (score <= 2) {
        // Minimal content - check if we have a usable hero photo
        const hasHeroPhoto = photoCount > 0 || activity.photos?.primary?.urls?.['600']
        return hasHeroPhoto ? 'compact' : 'minimal'
    } else if (score <= 5) {
        return 'compact'
    } else if (score <= 10) {
        return 'standard'
    } else {
        return 'full'
    }
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
 * - Description page OR comments page (always 2 pages)
 */
const renderMinimalPages = (props: Required<Omit<RaceSectionProps, 'variant'>>) => {
    const { activity, format, theme, mapboxToken } = props
    const hasDescription = !!activity.description
    const hasComments = (activity.comprehensiveData?.comments?.length || activity.comments?.length || 0) > 0 ||
        (activity.kudos_count || 0) > 0

    return (
        <>
            <RaceSectionStatsPage
                activity={activity}
                format={format}
                theme={theme}
                mapboxToken={mapboxToken}
            />
            {/* Second page: prefer description, fallback to comments for kudos display */}
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
            ) : (
                /* Fallback: render a minimal stats page duplicate to ensure 2 pages */
                <RaceSectionStatsPage
                    activity={activity}
                    format={format}
                    theme={theme}
                    mapboxToken={mapboxToken}
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
    variant = 'auto'
}: RaceSectionProps) => {
    // Resolve 'auto' variant to a concrete variant
    const resolvedVariant = variant === 'auto' ? determineAutoVariant(activity) : variant
    console.log(`[RaceSection] Rendering variant: ${variant} -> ${resolvedVariant}`)

    const props = { activity, format, theme, mapboxToken: mapboxToken || '', highlightLabel: highlightLabel || '' }

    return (
        <Document>
            {resolvedVariant === 'full' && renderFullPages(props)}
            {resolvedVariant === 'standard' && renderStandardPages(props)}
            {resolvedVariant === 'minimal' && renderMinimalPages(props)}
            {resolvedVariant === 'compact' && renderCompactPages(props)}
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
    variant = 'auto'
}: RaceSectionProps) => {
    // Resolve 'auto' variant to a concrete variant
    const resolvedVariant = variant === 'auto' ? determineAutoVariant(activity) : variant
    console.log(`[RaceSectionPages] Rendering variant: ${variant} -> ${resolvedVariant}`)

    const props = { activity, format, theme, mapboxToken: mapboxToken || '', highlightLabel: highlightLabel || '' }

    return (
        <>
            {resolvedVariant === 'full' && renderFullPages(props)}
            {resolvedVariant === 'standard' && renderStandardPages(props)}
            {resolvedVariant === 'minimal' && renderMinimalPages(props)}
            {resolvedVariant === 'compact' && renderCompactPages(props)}
        </>
    )
}

// Legacy exports for backwards compatibility during migration
export type Race2pVariant = RaceSectionVariant
export const Race_2p = RaceSection
export const Race_2pSpread = RaceSection
export const Race_2pSpreadPages = RaceSectionPages
