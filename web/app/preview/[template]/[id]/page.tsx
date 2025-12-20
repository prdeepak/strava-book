import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import AsyncPDFPreview from "@/components/AsyncPDFPreview"
import { fetchActivityForPreview, enrichActivityWithGeocoding } from "@/lib/activity-utils"

type RaceTemplate = 'race_1p' | 'race_2p' | 'race_1p_graph' | 'race_1p_scrapbook'

const VALID_TEMPLATES: RaceTemplate[] = ['race_1p', 'race_2p', 'race_1p_graph', 'race_1p_scrapbook']

export const metadata: Metadata = {
    title: "Strava Book - Page Preview",
}

export default async function PreviewPage(props: {
    params: Promise<{ template: string; id: string }>
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

    // Fetch activity with template-specific options
    const activity = await fetchActivityForPreview(accessToken, params.id, template)

    if (!activity) {
        return <div className="p-8 text-center">Activity not found or failed to load.</div>
    }

    // Enrich with geocoding if needed
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    console.log("[Server] Passing Mapbox Token:", !!mapboxToken)

    await enrichActivityWithGeocoding(activity, mapboxToken)

    return <AsyncPDFPreview activity={activity} mapboxToken={mapboxToken} template={template} />
}
