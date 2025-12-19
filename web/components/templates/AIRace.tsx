import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { StravaActivity } from '@/lib/strava'

// Register emoji source for proper emoji rendering in PDFs
Font.registerEmojiSource({
    format: 'png',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
})

// Register Google Fonts for more creative typography options
Font.register({
    family: 'Roboto',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlvAx05IsDqlA.ttf', fontWeight: 700 }, // Bold
        { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOkCnqEu92Fr1Mu52xPKTM1K9nz.ttf', fontStyle: 'italic' }, // Italic
    ]
})

Font.register({
    family: 'Open Sans',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/opensans/v34/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY1M2xLER.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/opensans/v34/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1y4nY1M2xLER.ttf', fontWeight: 700 }, // Bold
    ]
})

Font.register({
    family: 'Montserrat',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm459Wlhyw3JetbqKA.ttf', fontWeight: 700 }, // Bold
    ]
})

Font.register({
    family: 'Playfair Display',
    fonts: [
        { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTXtPA.ttf' }, // Regular
        { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_pqQXtPA.ttf', fontWeight: 700 }, // Bold
        { src: 'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFkD-vYSZviVYUb_rj3ij__anPXDTnohkk72xU.ttf', fontStyle: 'italic' }, // Italic
    ]
})

Font.register({
    family: 'Pacifico',
    src: 'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ96A4sijpFu_.ttf'
})

interface BodyElement {
    type: 'photo' | 'textBox' | 'stat' | 'comment'
    photoIndex?: number
    content?: string | { label: string, value: string } | { author: string, text: string }
    position: { x: number, y: number }
    size: { width: number, height: number }
    rotation?: number
    zIndex?: number
    style?: {
        font?: string
        backgroundColor?: string
        padding?: number
        textAlign?: 'left' | 'center' | 'right'
        borderRadius?: number
        shadow?: { offsetX: number, offsetY: number, blur: number, color: string }
    }
}

interface DesignSpec {
    fonts: {
        pageTitle: { family: string, size: number, color: string }
        sectionTitle: { family: string, size: number, color: string }
        body: { family: string, size: number, color: string }
        accent: { family: string, size: number, color: string }
    }
    colorScheme: {
        primary: string
        secondary: string
        background: string
        text: string
        accent: string
    }
    background?: {
        type: 'solid' | 'gradient'
        color?: string
        gradientStart?: string
        gradientEnd?: string
    }
    theme: string
    narrative: string
    bodyElements?: BodyElement[]
}

interface PhotoData {
    urls?: Record<string, string | number>
    caption?: string
}

interface ComprehensiveData {
    activity: StravaActivity
    photos: PhotoData[]
    comments: Array<{ author: string; text: string }>
    streams: Record<string, unknown>
}

interface AIRaceProps {
    designSpec: DesignSpec
    comprehensiveData: ComprehensiveData
    pageCount: number
    mapboxToken?: string
}

export const AIRace = ({ designSpec, comprehensiveData }: AIRaceProps) => {
    const { fonts, colorScheme, narrative, background, bodyElements } = designSpec
    const { activity, photos } = comprehensiveData

    // Determine background color
    const pageBackground = background?.type === 'gradient'
        ? background.gradientStart || colorScheme.background
        : background?.color || colorScheme.background

    // Prepare photo URLs with absolute paths
    const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const photoUrls: string[] = photos.slice(0, 3).map((photo: PhotoData) => {
        const photoUrlsObj = photo.urls || {}
        const rawUrl = photoUrlsObj['5000'] || photoUrlsObj['600'] || photoUrlsObj['100'] || Object.values(photoUrlsObj)[0]
        if (!rawUrl) return null
        return `${BASE_URL}/api/proxy-image?url=${encodeURIComponent(rawUrl as string)}`
    }).filter((url): url is string => url !== null)

    // Calculate key stats for stat elements
    const distanceKm = (activity.distance / 1000).toFixed(2)
    const movingTime = new Date(activity.moving_time * 1000).toISOString().substr(11, 8)
    const paceSeconds = activity.moving_time / (activity.distance / 1000)
    const paceMin = Math.floor(paceSeconds / 60)
    const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')
    const avgPace = `${paceMin}:${paceSec}/km`

    // Render bodyElements if provided (scrapbook mode)
    if (bodyElements && bodyElements.length > 0) {
        // Sort by zIndex for proper layering
        const sortedElements = [...bodyElements].sort((a, b) =>
            (a.zIndex || 0) - (b.zIndex || 0)
        )

        return (
            <Document>
                <Page size="LETTER" style={{ backgroundColor: pageBackground }}>
                    {sortedElements.map((element, index) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const baseStyle: any = {
                            position: 'absolute',
                            left: element.position.x,
                            top: element.position.y,
                            width: element.size.width,
                            height: element.size.height,
                            transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                        }

                        // Add border radius if specified
                        if (element.style?.borderRadius) {
                            baseStyle.borderRadius = element.style.borderRadius
                            baseStyle.overflow = 'hidden'
                        }

                        // Add shadow if specified (simulated with border for PDF)
                        if (element.style?.shadow) {
                            baseStyle.boxShadow = `${element.style.shadow.offsetX}px ${element.style.shadow.offsetY}px ${element.style.shadow.blur}px ${element.style.shadow.color}`
                        }

                        switch (element.type) {
                            case 'photo':
                                const photoUrl = photoUrls[element.photoIndex || 0]
                                if (!photoUrl) return null
                                return (
                                    <View key={index} style={baseStyle}>
                                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                        <Image src={photoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </View>
                                )

                            case 'textBox':
                                const fontKey = element.style?.font || 'body'
                                const font = fonts[fontKey as keyof typeof fonts] || fonts.body
                                return (
                                    <View key={index} style={{
                                        ...baseStyle,
                                        backgroundColor: element.style?.backgroundColor,
                                        padding: element.style?.padding || 0,
                                        justifyContent: 'center',
                                        alignItems: element.style?.textAlign === 'center' ? 'center' :
                                            element.style?.textAlign === 'right' ? 'flex-end' : 'flex-start'
                                    }}>
                                        <Text style={{
                                            fontFamily: font.family,
                                            fontSize: font.size,
                                            color: font.color,
                                            textAlign: element.style?.textAlign || 'left'
                                        }}>
                                            {element.content as string}
                                        </Text>
                                    </View>
                                )

                            case 'stat':
                                const statContent = element.content as { label: string, value: string }
                                return (
                                    <View key={index} style={{
                                        ...baseStyle,
                                        backgroundColor: element.style?.backgroundColor || '#FFFFFF',
                                        padding: element.style?.padding || 8,
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}>
                                        <Text style={{
                                            fontFamily: fonts.sectionTitle.family,
                                            fontSize: fonts.sectionTitle.size + 6,
                                            color: colorScheme.primary,
                                            fontWeight: 'bold'
                                        }}>
                                            {statContent.value}
                                        </Text>
                                        <Text style={{
                                            fontFamily: fonts.body.family,
                                            fontSize: fonts.body.size - 2,
                                            color: colorScheme.accent,
                                            marginTop: 2
                                        }}>
                                            {statContent.label}
                                        </Text>
                                    </View>
                                )

                            case 'comment':
                                const commentContent = element.content as { author: string, text: string }
                                return (
                                    <View key={index} style={{
                                        ...baseStyle,
                                        backgroundColor: element.style?.backgroundColor || '#FFFACD',
                                        padding: element.style?.padding || 8,
                                    }}>
                                        <Text style={{
                                            fontFamily: fonts.sectionTitle.family,
                                            fontSize: fonts.body.size,
                                            color: colorScheme.primary,
                                            marginBottom: 2
                                        }}>
                                            {commentContent.author}:
                                        </Text>
                                        <Text style={{
                                            fontFamily: fonts.body.family,
                                            fontSize: fonts.body.size - 1,
                                            color: colorScheme.text
                                        }}>
                                            {commentContent.text}
                                        </Text>
                                    </View>
                                )

                            default:
                                return null
                        }
                    })}
                </Page>
            </Document>
        )
    }

    // Fallback to traditional layout if no bodyElements
    // (Keep existing code for backward compatibility)
    const styles = StyleSheet.create({
        page: {
            backgroundColor: pageBackground,
            padding: 25,
            flexDirection: 'column',
        },
        title: {
            fontSize: fonts.pageTitle.size,
            fontFamily: fonts.pageTitle.family,
            color: fonts.pageTitle.color,
            marginBottom: 20,
        },
        narrative: {
            fontSize: fonts.accent.size,
            fontFamily: fonts.accent.family,
            color: colorScheme.text,
            marginBottom: 15,
            padding: 10,
            backgroundColor: colorScheme.secondary + '20',
            borderLeftWidth: 3,
            borderLeftColor: colorScheme.primary,
        },
    })

    return (
        <Document>
            <Page size="LETTER" style={styles.page}>
                <Text style={styles.title}>{activity.name}</Text>
                {narrative && (
                    <View style={styles.narrative}>
                        <Text>{narrative}</Text>
                    </View>
                )}
                <Text style={{ fontSize: 10 }}>Distance: {distanceKm} km</Text>
                <Text style={{ fontSize: 10 }}>Time: {movingTime}</Text>
                <Text style={{ fontSize: 10 }}>Pace: {avgPace}</Text>
            </Page>
        </Document>
    )
}
