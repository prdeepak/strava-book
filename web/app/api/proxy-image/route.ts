import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'

const logFile = join(process.cwd(), 'debug-photos.log')

function log(message: string) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}\n`
    try {
        appendFileSync(logFile, logMessage)
    } catch (e) {
        console.error('Failed to write to log file:', e)
    }
    console.log(message)
}

export async function GET(request: NextRequest) {
    log('[Proxy] Request received')
    const searchParams = request.nextUrl.searchParams
    const imageUrl = searchParams.get('url')

    log(`[Proxy] URL parameter: ${imageUrl}`)

    if (!imageUrl) {
        log('[Proxy] No URL provided')
        return new NextResponse("Missing URL", { status: 400 })
    }

    try {
        log(`[Proxy] Fetching: ${imageUrl}`)
        const response = await fetch(imageUrl)

        log(`[Proxy] Response status: ${response.status}`)

        if (!response.ok) {
            log(`[Proxy] Failed: ${response.status} ${response.statusText}`)
            const text = await response.text()
            log(`[Proxy] Body: ${text}`)
            return new NextResponse(`Upstream Error: ${text}`, { status: response.status })
        }

        const blob = await response.blob()
        log(`[Proxy] Success: ${blob.size} bytes, Type: ${blob.type}`)

        const headers = new Headers()
        headers.set("Content-Type", response.headers.get("Content-Type") || "image/jpeg")
        headers.set("Cache-Control", "public, max-age=31536000")

        return new NextResponse(blob, { headers })
    } catch (e) {
        log(`[Proxy] Exception: ${e}`)
        return new NextResponse("Failed to fetch image", { status: 500 })
    }
}
