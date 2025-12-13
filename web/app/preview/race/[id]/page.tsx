import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "../../../api/auth/[...nextauth]/route"
import { StravaActivity } from "@/lib/strava"
import AsyncPDFPreview from "@/components/AsyncPDFPreview"

export default async function PreviewPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect("/api/auth/signin")
    }

    const accessToken = session.accessToken

    // Let's just fetch the specific one.

    let activity: StravaActivity | null = null

    try {
        const res = await fetch(`https://www.strava.com/api/v3/activities/${params.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        if (res.ok) {
            activity = await res.json()
        }
    } catch (e) {
        // error
    }

    if (!activity) {
        return <div>Activity not found</div>
    }

    return <AsyncPDFPreview activity={activity} />
}
