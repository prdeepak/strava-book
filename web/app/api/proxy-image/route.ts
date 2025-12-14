import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
        return new NextResponse("Missing URL", { status: 400 })
    }

    try {
        console.log(`[Proxy] Fetching: ${imageUrl}`)
        const response = await fetch(imageUrl)

        if (!response.ok) {
            console.error(`[Proxy] Failed: ${response.status} ${response.statusText}`)
            const text = await response.text()
            console.error(`[Proxy] Body: ${text}`)
            return new NextResponse(`Upstream Error: ${text}`, { status: response.status })
        }

        const blob = await response.blob()
        console.log(`[Proxy] Success: ${blob.size} bytes, Type: ${blob.type}`)

        const headers = new Headers()
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg")
        headers.set("Cache-Control", "public, max-age=31536000")

        return new NextResponse(blob, { headers })
    } catch (e) {
        console.error("Proxy error:", e)
        return new NextResponse("Failed to fetch image", { status: 500 })
    }
}
