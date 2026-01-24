import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import AsyncPDFPreview from "@/components/AsyncPDFPreview"
import { enrichActivityWithGeocoding } from "@/lib/activity-utils"
import { enrichActivityWithPhotos, convertPhotosToBase64 } from "@/lib/photo-utils"
import { getActivity, getActivityComments } from "@/lib/strava"
import { getSingleActivityTemplates } from "@/lib/template-specs/registry"

// Get valid templates from registry + concat_all special option
const VALID_TEMPLATES = [...getSingleActivityTemplates().map(t => t.id), 'concat_all']

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
        redirect("/signin")
    }

    // Validate template parameter against registry
    if (!VALID_TEMPLATES.includes(params.template)) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Invalid Template</h1>
                <p>Template &ldquo;{params.template}&rdquo; is not supported.</p>
                <p className="mt-2">Valid templates: {VALID_TEMPLATES.join(', ')}</p>
            </div>
        )
    }

    const template = params.template
    const accessToken = session.accessToken

    // Fetch comprehensive activity data (same as comprehensive-activity-data API)
    let activity
    let error = null

    try {
        const [activityData, comments] = await Promise.all([
            getActivity(accessToken, params.id),
            getActivityComments(accessToken, params.id),
        ])

        if (!activityData) {
            error = 'not_found'
        } else {
            // Enrich activity with photos using shared utility
            // This properly structures photos.primary.urls for templates
            const enrichedActivity = await enrichActivityWithPhotos(activityData, accessToken)
            enrichedActivity.comments = comments
            activity = enrichedActivity
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
    const variant = typeof searchParams?.variant === 'string' ? searchParams.variant : undefined
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

    // Convert photo URLs to base64 for client-side PDF rendering
    // This is needed because PDFViewer runs in the browser and Strava URLs have CORS restrictions
    if (includePhotos) {
        activity = await convertPhotosToBase64(activity!)
    }

    return <AsyncPDFPreview activity={activity!} mapboxToken={mapboxToken} template={template} variant={variant} />
}
