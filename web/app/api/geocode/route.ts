import { NextRequest, NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/geocoding'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    if (!lat || !lng) {
        return NextResponse.json({ error: 'Missing lat/lng parameters' }, { status: 400 })
    }

    if (!mapboxToken) {
        return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 })
    }

    try {
        const location = await reverseGeocode(parseFloat(lat), parseFloat(lng), mapboxToken)
        return NextResponse.json({ location })
    } catch (error) {
        console.error('Geocoding error:', error)
        return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
    }
}
