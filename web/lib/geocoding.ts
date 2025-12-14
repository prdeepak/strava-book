// Mapbox Reverse Geocoding to get city/county from coordinates
export async function reverseGeocode(lat: number, lng: number, mapboxToken: string): Promise<string | null> {
    try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality&access_token=${mapboxToken}`
        const response = await fetch(url)

        if (!response.ok) {
            console.error(`Mapbox geocoding failed: ${response.status}`)
            return null
        }

        const data = await response.json()

        // Get the first place result (city/locality)
        if (data.features && data.features.length > 0) {
            return data.features[0].place_name || data.features[0].text
        }

        return null
    } catch (error) {
        console.error('Reverse geocoding error:', error)
        return null
    }
}
