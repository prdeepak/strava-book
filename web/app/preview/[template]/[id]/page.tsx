import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import AsyncPDFPreview from "@/components/AsyncPDFPreview"
import { enrichActivityWithGeocoding } from "@/lib/activity-utils"
import { getActivity, getActivityComments, getActivityPhotos } from "@/lib/strava"

type RaceTemplate = 'race_1p' | 'race_2p' | 'race_1p_scrapbook'

const VALID_TEMPLATES: RaceTemplate[] = ['race_1p', 'race_2p', 'race_1p_scrapbook']

export const metadata: Metadata = {
    title: "Strava Book - Page Preview",
}

export default async function PreviewPage(props: {
    params: Promise<{ template: string; id: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await props.params
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    // Validate template parameter
    if (!VALID_TEMPLATES.includes(params.template as RaceTemplate)) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Invalid Template</h1>
                <p>Template &ldquo;{params.template}&rdquo; is not supported.</p>
                <p className="mt-2">Valid templates: {VALID_TEMPLATES.join(', ')}</p>
            </div>
        )
    }

    const template = params.template as RaceTemplate
    const accessToken = session.accessToken

    // Fetch comprehensive activity data (same as comprehensive-activity-data API)
    let activity
    let error = null

    try {
        const [activityData, photos, comments] = await Promise.all([
            getActivity(accessToken, params.id),
            getActivityPhotos(accessToken, params.id),
            getActivityComments(accessToken, params.id),
        ])

        if (!activityData) {
            error = 'not_found'
        } else {
            // Attach fetched data to activity object
            activityData.allPhotos = photos
            activityData.comments = comments
            activity = activityData
        }
    } catch (err) {
        console.error('Error fetching activity:', err)
        error = 'fetch_failed'
    }

    // Handle errors outside try/catch to avoid JSX in try/catch
    if (error === 'not_found') {
        return <div className="p-8 text-center">Activity not found or failed to load.</div>
    }
    if (error === 'fetch_failed') {
        return <div className="p-8 text-center">Failed to load activity data.</div>
    }

    // Read user selections from URL parameters
    const searchParams = await props.searchParams
    const includePhotos = searchParams?.includePhotos !== 'false'
    const includeComments = searchParams?.includeComments !== 'false'
    const includeSplits = searchParams?.includeSplits !== 'false'
    const includeLaps = searchParams?.includeLaps !== 'false'
    const includeBestEfforts = searchParams?.includeBestEfforts !== 'false'
    const includeElevation = searchParams?.includeElevation !== 'false'
    const photoIds = typeof searchParams?.photoIds === 'string'
        ? searchParams.photoIds.split(',').filter(Boolean)
        : []

    // Filter activity data based on user selections
    if (!includeComments) {
        activity!.comments = []
    }
    if (!includeBestEfforts) {
        activity!.best_efforts = []
    }
    if (!includeSplits) {
        activity!.splits_metric = []
        activity!.laps = []
    }
    if (!includeLaps) {
        activity!.laps = []
    }
    if (!includePhotos || photoIds.length > 0) {
        // If photos not included, clear all photos
        // If specific photos selected, filter to only those
        if (!includePhotos) {
            activity!.allPhotos = []
            if (activity!.photos) {
                // @ts-expect-error - Setting to null to clear primary photo
                activity!.photos.primary = null
            }
        } else if (photoIds.length > 0) {
            // Filter allPhotos to only selected IDs
            activity!.allPhotos = activity!.allPhotos?.filter(p => photoIds.includes(p.unique_id)) || []
        }
    }

    // Enrich with geocoding if needed
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log("[Server] Passing Mapbox Token:", !!mapboxToken)
    console.log("[Server] User selections:", { includePhotos, includeComments, includeSplits, includeLaps, includeBestEfforts, includeElevation, photoCount: photoIds.length })

    await enrichActivityWithGeocoding(activity!, mapboxToken)

    return <AsyncPDFPreview activity={activity!} mapboxToken={mapboxToken} template={template} />
}
