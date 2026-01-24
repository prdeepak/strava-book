import { getServerSession } from "next-auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { authOptions } from "../../api/auth/[...nextauth]/route"
import { getAthleteActivities } from "@/lib/strava"
import { generateSmartDraft } from "@/lib/curator"
import AsyncBookPreview from "@/components/AsyncBookPreview"

export const metadata: Metadata = {
    title: "Strava Book - Full Preview",
}

export default async function BookPreviewPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin/strava")
    }

    const accessToken = session.accessToken

    // Fetch up to 30 recent activities
    const activities = await getAthleteActivities(accessToken)

    // Generate the Smart Draft Plan
    const entries = generateSmartDraft(activities)

    return <AsyncBookPreview entries={entries} activities={activities} />
}
