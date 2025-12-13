import { StravaActivity } from "./strava"

export type BookPageType = 'COVER' | 'RACE_PAGE' | 'STATS_SUMMARY'

export interface BookEntry {
    type: BookPageType
    title?: string
    activityId?: number
    highlightLabel?: string
}

export function generateSmartDraft(activities: StravaActivity[]): BookEntry[] {
    const draft: BookEntry[] = []

    // 1. Cover Page
    draft.push({ type: 'COVER', title: 'My Year in Review' })

    if (activities.length === 0) return draft

    // 2. Find Highlights
    // Copy array to avoid mutating original
    const sortedByDist = [...activities].sort((a, b) => b.distance - a.distance)
    const sortedByElev = [...activities].sort((a, b) => b.total_elevation_gain - a.total_elevation_gain)

    const longest = sortedByDist[0]
    const hilliest = sortedByElev[0]

    // 3. Add Longest Run
    if (longest) {
        draft.push({
            type: 'RACE_PAGE',
            activityId: longest.id,
            highlightLabel: 'Longest Effort of the Year'
        })
    }

    // 4. Add Hilliest Run (if different)
    if (hilliest && hilliest.id !== longest?.id) {
        draft.push({
            type: 'RACE_PAGE',
            activityId: hilliest.id,
            highlightLabel: 'King of the Mountains'
        })
    }

    // 5. Add a few recent ones just to fill the book for demo
    const recent = activities.slice(0, 3).filter(a => a.id !== longest?.id && a.id !== hilliest?.id)
    recent.forEach(a => {
        draft.push({
            type: 'RACE_PAGE',
            activityId: a.id,
            highlightLabel: 'Recent Application'
        })
    })

    return draft
}
