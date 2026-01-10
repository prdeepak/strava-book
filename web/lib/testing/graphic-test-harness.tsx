/**
 * Graphic Test Harness - Generate and evaluate individual graphics components
 *
 * This enables B agents to iterate on graphics (splits, elevation, map, heatmap)
 * with the same feedback loop as templates.
 *
 * Usage:
 *   npx tsx graphic-test-harness.tsx --graphic splits --fixture race_marathon --verbose
 */

import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import { Document, Page, View, StyleSheet, Svg, Rect, Text as SvgText } from '@react-pdf/renderer'
import { renderToBuffer } from '@react-pdf/renderer'
import { pdfToImages, loadFixture, generateRunId, getRunOutputDir } from './test-harness'
import { judgePageVisual, VisualJudgment, JudgeContext } from './visual-judge'
import { SplitsChartSVG, SplitData } from '../generateSplitsChart'
import { ElevationProfileSVG, splitsToElevationData } from '../generateElevationProfile'
import { StravaActivity } from '../strava'
import polyline from '@mapbox/polyline'

// ============================================================================
// Types
// ============================================================================

export type GraphicType = 'splits' | 'elevation' | 'map' | 'heatmap'

export interface GraphicTestResult {
    graphicType: GraphicType
    fixtureName: string
    imagePath: string
    judgment?: VisualJudgment
    pass: boolean
    score: number
    duration: number
    error?: string
}

export interface GraphicTestConfig {
    outputDir?: string
    runId?: string
    width?: number
    height?: number
    verbose?: boolean
    skipJudge?: boolean
}

// ============================================================================
// Graphic-Specific Judge Criteria
// ============================================================================

export const GRAPHIC_JUDGE_CRITERIA: Record<GraphicType, {
    criteria: string[]
    passThreshold: number
    prompt: string
}> = {
    splits: {
        criteria: [
            'Bar proportions accurate and proportional to pace',
            'Labels readable at this size',
            'Pace scale on left axis is clear',
            'Colors consistent and professional',
            'Progress markers (25%, 50%, 75%) visible if present',
            'Finish flag/time readable'
        ],
        passThreshold: 75,
        prompt: `You are evaluating a SPLITS CHART graphic for a running/cycling activity.
This chart shows pace bars for each split/lap, with elevation profile below.

Evaluate on:
1. DATA CLARITY (40%): Are the pace bars proportional and easy to compare? Are labels readable?
2. VISUAL DESIGN (30%): Is the color scheme professional? Good contrast? Clean layout?
3. TECHNICAL QUALITY (30%): Are axes labeled correctly? Markers positioned well? No clipping?

Return ONLY valid JSON (no markdown):
{
  "printReadability": { "score": <0-100>, "issues": [] },
  "layoutBalance": { "score": <0-100>, "issues": [] },
  "brandCohesion": { "score": <0-100>, "issues": [] },
  "overallScore": <0-100>,
  "pass": <true if >= 75>,
  "summary": "Brief assessment",
  "suggestions": ["improvement1", "improvement2"]
}`
    },
    elevation: {
        criteria: [
            'Profile shape is smooth and accurate',
            'Scale labels are readable',
            'Fill color is consistent',
            'Axis labels are clear',
            'No visual artifacts or clipping'
        ],
        passThreshold: 75,
        prompt: `You are evaluating an ELEVATION PROFILE graphic for a running/cycling activity.
This chart shows elevation gain/loss over the course of an activity.

Evaluate on:
1. DATA CLARITY (40%): Is the elevation profile shape clear? Scale readable?
2. VISUAL DESIGN (30%): Good fill color? Professional appearance?
3. TECHNICAL QUALITY (30%): Proper axes? No artifacts? Clean rendering?

Return ONLY valid JSON (no markdown):
{
  "printReadability": { "score": <0-100>, "issues": [] },
  "layoutBalance": { "score": <0-100>, "issues": [] },
  "brandCohesion": { "score": <0-100>, "issues": [] },
  "overallScore": <0-100>,
  "pass": <true if >= 75>,
  "summary": "Brief assessment",
  "suggestions": ["improvement1", "improvement2"]
}`
    },
    map: {
        criteria: [
            'Route is clearly visible',
            'Sufficient contrast with background',
            'Resolution is adequate for print',
            'Bounds appropriately frame the route',
            'Route color/thickness appropriate'
        ],
        passThreshold: 70,
        prompt: `You are evaluating a ROUTE MAP graphic for a running/cycling activity.
This shows the GPS route as an SVG polyline on a dark background.

Evaluate on:
1. ROUTE VISIBILITY (40%): Is the route clearly visible? Good contrast?
2. FRAMING (30%): Does the map frame the route well? Not too zoomed in/out?
3. PRINT QUALITY (30%): Resolution adequate? Will it print well?

Return ONLY valid JSON (no markdown):
{
  "printReadability": { "score": <0-100>, "issues": [] },
  "layoutBalance": { "score": <0-100>, "issues": [] },
  "brandCohesion": { "score": <0-100>, "issues": [] },
  "overallScore": <0-100>,
  "pass": <true if >= 70>,
  "summary": "Brief assessment",
  "suggestions": ["improvement1", "improvement2"]
}`
    },
    heatmap: {
        criteria: [
            'Grid is properly aligned',
            'Color scale is clear and readable',
            'Legend is present and readable',
            'Days are distinguishable',
            'Month/week labels visible'
        ],
        passThreshold: 75,
        prompt: `You are evaluating a YEAR HEATMAP graphic (GitHub contribution style).
This shows activity frequency/intensity over a year as a grid of colored cells.

Evaluate on:
1. DATA CLARITY (40%): Are activity levels distinguishable? Color scale clear?
2. LAYOUT (30%): Grid properly aligned? Labels readable? Legend present?
3. VISUAL DESIGN (30%): Professional appearance? Good color choices?

Return ONLY valid JSON (no markdown):
{
  "printReadability": { "score": <0-100>, "issues": [] },
  "layoutBalance": { "score": <0-100>, "issues": [] },
  "brandCohesion": { "score": <0-100>, "issues": [] },
  "overallScore": <0-100>,
  "pass": <true if >= 75>,
  "summary": "Brief assessment",
  "suggestions": ["improvement1", "improvement2"]
}`
    }
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
    page: {
        backgroundColor: 'white',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    }
})

// ============================================================================
// Graphic Renderers
// ============================================================================

/**
 * Render splits chart to a PDF document
 */
function renderSplitsGraphic(fixture: StravaActivity, width: number, height: number): React.ReactElement {
    const splits: SplitData[] = []

    // Try splits_metric first, then laps
    if (fixture.splits_metric && fixture.splits_metric.length > 0) {
        fixture.splits_metric.forEach((split, index) => {
            splits.push({
                split: index + 1,
                label: `${index + 1}`,
                moving_time: split.moving_time || 0,
                distance: split.distance || 0,
                elevation_difference: split.elevation_difference || 0
            })
        })
    } else if (fixture.laps && fixture.laps.length > 0) {
        fixture.laps.forEach((lap, index) => {
            splits.push({
                split: index + 1,
                label: `${index + 1}`,
                moving_time: lap.moving_time || 0,
                distance: lap.distance || 0,
                elevation_difference: lap.total_elevation_gain || 0
            })
        })
    }

    if (splits.length === 0) {
        throw new Error('No splits or laps data in fixture')
    }

    const totalTime = fixture.moving_time || splits.reduce((sum, s) => sum + s.moving_time, 0)

    return (
        <Document>
            <Page size={[width + 40, height + 40]} style={styles.page}>
                <View style={styles.container}>
                    <SplitsChartSVG
                        splits={splits}
                        totalTime={totalTime}
                        width={width}
                        height={height}
                    />
                </View>
            </Page>
        </Document>
    )
}

/**
 * Render elevation profile to a PDF document using standalone ElevationProfileSVG
 */
function renderElevationGraphic(fixture: StravaActivity, width: number, height: number): React.ReactElement {
    // Extract splits data
    const splits: Array<{ distance: number; elevation_difference: number }> = []

    if (fixture.splits_metric && fixture.splits_metric.length > 0) {
        fixture.splits_metric.forEach(split => {
            splits.push({
                distance: split.distance || 0,
                elevation_difference: split.elevation_difference || 0
            })
        })
    } else if (fixture.laps && fixture.laps.length > 0) {
        fixture.laps.forEach(lap => {
            splits.push({
                distance: lap.distance || 0,
                elevation_difference: lap.total_elevation_gain || 0
            })
        })
    }

    if (splits.length === 0) {
        throw new Error('No splits or laps data in fixture for elevation profile')
    }

    // Calculate base elevation from activity data if available
    const baseElevation = fixture.elev_low || 0

    // Convert splits to elevation data
    const elevationData = splitsToElevationData(splits, baseElevation)

    return (
        <Document>
            <Page size={[width + 40, height + 40]} style={styles.page}>
                <View style={styles.container}>
                    <ElevationProfileSVG
                        data={elevationData}
                        width={width}
                        height={height}
                        fillColor="#3b82f6"
                        strokeColor="#1d4ed8"
                        backgroundColor="white"
                        showGrid={true}
                        showStats={true}
                    />
                </View>
            </Page>
        </Document>
    )
}

/**
 * Render route map to a PDF document (SVG polyline)
 *
 * Improvements:
 * - Better centering with aspect ratio preservation
 * - Subtle grid lines for geographic context
 * - Start/end markers for visual polish
 * - Increased padding around route endpoints
 */
function renderMapGraphic(fixture: StravaActivity, width: number, height: number): React.ReactElement {
    const polylineStr = fixture.map?.summary_polyline
    if (!polylineStr) {
        throw new Error('No polyline data in fixture')
    }

    // Decode polyline
    const coordinates = polyline.decode(polylineStr)
    if (coordinates.length === 0) {
        throw new Error('Empty polyline data')
    }

    // Find bounds
    const lats = coordinates.map((c: number[]) => c[0])
    const lngs = coordinates.map((c: number[]) => c[1])
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const latRange = maxLat - minLat || 0.001
    const lngRange = maxLng - minLng || 0.001

    // Add margin for start/end markers and better framing
    const margin = 15  // pixels for markers and padding

    // Calculate available drawing area
    const drawWidth = width - margin * 2
    const drawHeight = height - margin * 2

    // Calculate scale to fit route within available area while preserving aspect ratio
    const scaleX = drawWidth / lngRange
    const scaleY = drawHeight / latRange
    const scale = Math.min(scaleX, scaleY)

    // Calculate actual dimensions after scaling
    const scaledWidth = lngRange * scale
    const scaledHeight = latRange * scale

    // Center the route: offset to place route center at canvas center
    const offsetX = (width - scaledWidth) / 2
    const offsetY = (height - scaledHeight) / 2

    // Normalize to SVG coordinates - centered within the canvas
    const svgPoints = coordinates.map(([lat, lng]: number[]) => {
        const x = offsetX + (lng - minLng) * scale
        const y = offsetY + (maxLat - lat) * scale
        return { x, y }
    })

    const points = svgPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

    // Get start and end points
    const startPoint = svgPoints[0]
    const endPoint = svgPoints[svgPoints.length - 1]

    // Use components from react-pdf
    const { Polyline, Circle, Line } = require('@react-pdf/renderer')

    // Generate subtle grid lines for geographic context - visible for print
    const gridLines: React.ReactElement[] = []
    const gridSpacing = 40
    const gridColor = '#4a4a4a'  // More visible gray for print

    // Vertical grid lines
    for (let x = gridSpacing; x < width; x += gridSpacing) {
        gridLines.push(
            <Line
                key={`v-${x}`}
                x1={String(x)}
                y1="0"
                x2={String(x)}
                y2={String(height)}
                stroke={gridColor}
                strokeWidth="1"
            />
        )
    }

    // Horizontal grid lines
    for (let y = gridSpacing; y < height; y += gridSpacing) {
        gridLines.push(
            <Line
                key={`h-${y}`}
                x1="0"
                y1={String(y)}
                x2={String(width)}
                y2={String(y)}
                stroke={gridColor}
                strokeWidth="1"
            />
        )
    }

    return (
        <Document>
            <Page size={[width + 40, height + 40]} style={styles.page}>
                <View style={styles.container}>
                    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                        {/* Dark background */}
                        <Rect x="0" y="0" width={String(width)} height={String(height)} fill="#1a1a1a" />

                        {/* Subtle grid for geographic context */}
                        {gridLines}

                        {/* Route path with Strava orange - thicker for print visibility */}
                        <Polyline
                            points={points}
                            fill="none"
                            stroke="#fc4c02"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Start marker - green circle with "S" label */}
                        <Circle
                            cx={String(startPoint.x.toFixed(2))}
                            cy={String(startPoint.y.toFixed(2))}
                            r="9"
                            fill="#22c55e"
                            stroke="#ffffff"
                            strokeWidth="2"
                        />
                        <SvgText
                            x={String(startPoint.x.toFixed(2))}
                            y={String((startPoint.y + 3).toFixed(2))}
                            style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}
                            fill="#ffffff"
                            textAnchor="middle"
                        >
                            S
                        </SvgText>

                        {/* End marker - red circle with "F" label */}
                        <Circle
                            cx={String(endPoint.x.toFixed(2))}
                            cy={String(endPoint.y.toFixed(2))}
                            r="9"
                            fill="#dc2626"
                            stroke="#ffffff"
                            strokeWidth="2"
                        />
                        <SvgText
                            x={String(endPoint.x.toFixed(2))}
                            y={String((endPoint.y + 3).toFixed(2))}
                            style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}
                            fill="#ffffff"
                            textAnchor="middle"
                        >
                            F
                        </SvgText>
                    </Svg>
                </View>
            </Page>
        </Document>
    )
}

/**
 * Render year heatmap to a PDF document (GitHub contribution style)
 */
function renderHeatmapGraphic(fixture: StravaActivity, width: number, height: number): React.ReactElement {
    const activityDate = new Date(fixture.start_date)
    const year = activityDate.getFullYear()

    // Create mock activity data for the year to demonstrate the heatmap
    const activityDays = new Map<string, number>()

    // Add the actual activity
    activityDays.set(fixture.start_date.split('T')[0], fixture.distance || 10000)

    // Generate realistic training pattern data around the activity date
    const baseDate = new Date(fixture.start_date)
    const seededRandom = (seed: number) => {
        const x = Math.sin(seed) * 10000
        return x - Math.floor(x)
    }
    for (let i = -90; i <= 30; i++) {
        const date = new Date(baseDate)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        if (activityDays.has(dateStr)) continue

        const dayOfWeek = date.getDay()
        const daysToRace = Math.abs(i)
        const seed = i + 1000

        if (dayOfWeek === 0 && seededRandom(seed) > 0.3) continue
        if (daysToRace < 7 && i < 0) continue
        if (seededRandom(seed + 1) > 0.6) continue

        let distance = 5000 + seededRandom(seed + 2) * 10000
        if (daysToRace < 30 && i < 0) distance *= 1.2
        if (daysToRace < 14 && i < 0) distance *= 0.7
        if (i > 0) distance *= 0.5

        activityDays.set(dateStr, distance)
    }

    // Layout constants
    const leftMargin = 35
    const topMargin = 45
    const bottomMargin = 45
    const rightMargin = 10

    const gridWidth = width - leftMargin - rightMargin
    const gridHeight = height - topMargin - bottomMargin

    const weeksInYear = 53
    const daysInWeek = 7
    const cellGap = 2
    const cellSize = Math.min(
        (gridWidth - (weeksInYear - 1) * cellGap) / weeksInYear,
        (gridHeight - (daysInWeek - 1) * cellGap) / daysInWeek
    )

    // Color scale (Strava orange tones)
    const colorScale = ['#ebedf0', '#ffd4c4', '#ffaa88', '#fc6c32', '#fc4c02']
    const maxValue = Math.max(...Array.from(activityDays.values()))

    const getColor = (value: number): string => {
        if (value === 0) return colorScale[0]
        const normalized = value / maxValue
        if (normalized < 0.25) return colorScale[1]
        if (normalized < 0.5) return colorScale[2]
        if (normalized < 0.75) return colorScale[3]
        return colorScale[4]
    }

    const cells: React.ReactElement[] = []
    const startDate = new Date(year, 0, 1)
    const startDay = startDate.getDay()

    const monthLabels: React.ReactElement[] = []
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let lastMonth = -1

    for (let week = 0; week < weeksInYear; week++) {
        for (let day = 0; day < daysInWeek; day++) {
            const dayIndex = week * 7 + day - startDay
            const date = new Date(year, 0, 1 + dayIndex)
            if (date.getFullYear() !== year) continue

            const dateStr = date.toISOString().split('T')[0]
            const value = activityDays.get(dateStr) || 0
            const x = leftMargin + week * (cellSize + cellGap)
            const y = topMargin + day * (cellSize + cellGap)

            cells.push(
                <Rect
                    key={`cell-${week}-${day}`}
                    x={String(x)}
                    y={String(y)}
                    width={String(cellSize)}
                    height={String(cellSize)}
                    fill={getColor(value)}
                    rx="2"
                    ry="2"
                />
            )

            if (date.getMonth() !== lastMonth && day === 0) {
                lastMonth = date.getMonth()
                monthLabels.push(
                    <SvgText
                        key={`month-${lastMonth}`}
                        x={String(x)}
                        y={String(topMargin - 8)}
                        style={{ fontSize: 9, fontFamily: 'Helvetica', fill: '#586069' }}
                    >
                        {monthNames[lastMonth]}
                    </SvgText>
                )
            }
        }
    }

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const dayLabelElements = [1, 3, 5].map(dayIndex => (
        <SvgText
            key={`day-${dayIndex}`}
            x={String(leftMargin - 6)}
            y={String(topMargin + dayIndex * (cellSize + cellGap) + cellSize * 0.75)}
            style={{ fontSize: 9, fontFamily: 'Helvetica', fill: '#586069' }}
            textAnchor="end"
        >
            {dayLabels[dayIndex]}
        </SvgText>
    ))

    const legendY = height - 25
    const legendX = width - 160
    const legendCellSize = 10
    const legendGap = 3

    const legendElements = [
        <SvgText key="legend-less" x={String(legendX - 5)} y={String(legendY + legendCellSize * 0.75)}
            style={{ fontSize: 9, fontFamily: 'Helvetica', fill: '#586069' }} textAnchor="end">Less</SvgText>,
        ...colorScale.map((color, i) => (
            <Rect key={`legend-${i}`} x={String(legendX + i * (legendCellSize + legendGap))} y={String(legendY)}
                width={String(legendCellSize)} height={String(legendCellSize)} fill={color} rx="2" ry="2" />
        )),
        <SvgText key="legend-more" x={String(legendX + colorScale.length * (legendCellSize + legendGap) + 5)}
            y={String(legendY + legendCellSize * 0.75)} style={{ fontSize: 9, fontFamily: 'Helvetica', fill: '#586069' }}>More</SvgText>
    ]

    const activityCount = activityDays.size

    return (
        <Document>
            <Page size={[width + 40, height + 40]} style={styles.page}>
                <View style={styles.container}>
                    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                        <Rect x="0" y="0" width={String(width)} height={String(height)} fill="white" />
                        <SvgText x={String(width / 2)} y="20"
                            style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', fill: '#24292e' }} textAnchor="middle">
                            {`${year} Activity Heatmap`}
                        </SvgText>
                        {monthLabels}
                        {dayLabelElements}
                        {cells}
                        {legendElements}
                        <SvgText x={String(leftMargin)} y={String(legendY + legendCellSize * 0.75)}
                            style={{ fontSize: 10, fontFamily: 'Helvetica', fill: '#24292e' }}>
                            {`${activityCount} activities in ${year}`}
                        </SvgText>
                    </Svg>
                </View>
            </Page>
        </Document>
    )
}

// ============================================================================
// Test Runner
// ============================================================================

export async function testGraphic(
    graphicType: GraphicType,
    fixtureName: string,
    config: GraphicTestConfig = {}
): Promise<GraphicTestResult> {
    const startTime = Date.now()
    const {
        outputDir: baseOutputDir = path.join(__dirname, '../../..', 'test-output'),
        runId = generateRunId(),
        width = 400,
        height = 200,
        verbose = false,
        skipJudge = false
    } = config

    const outputDir = getRunOutputDir(baseOutputDir, runId)
    fs.mkdirSync(outputDir, { recursive: true })

    const result: GraphicTestResult = {
        graphicType,
        fixtureName,
        imagePath: '',
        pass: false,
        score: 0,
        duration: 0
    }

    try {
        if (verbose) {
            console.log(`[Graphic Test] Loading fixture: ${fixtureName}`)
        }
        const fixture = loadFixture(fixtureName) as StravaActivity

        if (verbose) {
            console.log(`[Graphic Test] Rendering ${graphicType}...`)
        }

        let doc: React.ReactElement
        switch (graphicType) {
            case 'splits':
                doc = renderSplitsGraphic(fixture, width, height)
                break
            case 'elevation':
                doc = renderElevationGraphic(fixture, width, height)
                break
            case 'map':
                doc = renderMapGraphic(fixture, width, height)
                break
            case 'heatmap':
                doc = renderHeatmapGraphic(fixture, width, height)
                break
            default:
                throw new Error(`Unknown graphic type: ${graphicType}`)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(doc as any)
        const pdfPath = path.join(outputDir, `${graphicType}-${fixtureName}.pdf`)
        fs.writeFileSync(pdfPath, pdfBuffer)

        if (verbose) {
            console.log(`[Graphic Test] PDF saved: ${pdfPath}`)
        }

        const imagePaths = pdfToImages(pdfPath, outputDir, verbose)
        if (imagePaths.length === 0 || !imagePaths[0].endsWith('.png')) {
            throw new Error('Failed to convert PDF to image')
        }
        result.imagePath = imagePaths[0]

        if (verbose) {
            console.log(`[Graphic Test] Image saved: ${result.imagePath}`)
        }

        if (!skipJudge) {
            if (verbose) {
                console.log(`[Graphic Test] Running visual judge...`)
            }

            const criteria = GRAPHIC_JUDGE_CRITERIA[graphicType]
            const context: JudgeContext = {
                templateName: `${graphicType}-graphic`,
                pageType: graphicType,
                pageNumber: 1,
                customPrompt: criteria.prompt
            }

            const judgment = await judgePageVisual(result.imagePath, context, { verbose })
            result.judgment = judgment
            result.score = judgment.overallScore
            result.pass = judgment.overallScore >= criteria.passThreshold

            if (verbose) {
                console.log(`[Graphic Test] Score: ${result.score}/${criteria.passThreshold} threshold`)
                console.log(`[Graphic Test] ${result.pass ? 'PASS' : 'FAIL'}`)
                if (judgment.suggestions.length > 0) {
                    console.log(`[Graphic Test] Suggestions:`)
                    judgment.suggestions.forEach(s => console.log(`  - ${s}`))
                }
            }
        }

        fs.unlinkSync(pdfPath)

    } catch (error) {
        result.error = String(error)
        if (verbose) {
            console.error(`[Graphic Test] Error:`, error)
        }
    }

    result.duration = Date.now() - startTime
    return result
}

// ============================================================================
// CLI Interface
// ============================================================================

export function getAvailableGraphics(): GraphicType[] {
    return ['splits', 'elevation', 'map', 'heatmap']
}

if (require.main === module) {
    const args = process.argv.slice(2)

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Graphic Test Harness

Usage:
  npx tsx graphic-test-harness.tsx [options]

Options:
  --graphic <type>   Graphic type: splits, elevation, map, heatmap
  --fixture <name>   Fixture name (e.g., race_marathon)
  --width <n>        Width in points (default: 400)
  --height <n>       Height in points (default: 200)
  --verbose          Show detailed output
  --skip-judge       Generate image only, skip evaluation
  --list             List available graphics and fixtures

Examples:
  npx tsx graphic-test-harness.tsx --graphic splits --fixture race_marathon --verbose
  npx tsx graphic-test-harness.tsx --graphic map --fixture race_ultramarathon
  npx tsx graphic-test-harness.tsx --list
        `)
        process.exit(0)
    }

    if (args.includes('--list')) {
        console.log('Available Graphics:', getAvailableGraphics().join(', '))
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getAvailableFixtures } = require('./test-harness')
        console.log('Available Fixtures:', getAvailableFixtures().join(', '))
        process.exit(0)
    }

    const graphicIdx = args.indexOf('--graphic')
    const fixtureIdx = args.indexOf('--fixture')
    const widthIdx = args.indexOf('--width')
    const heightIdx = args.indexOf('--height')
    const verbose = args.includes('--verbose')
    const skipJudge = args.includes('--skip-judge')

    if (graphicIdx < 0 || fixtureIdx < 0) {
        console.log('Specify --graphic and --fixture. See --help for usage.')
        process.exit(1)
    }

    const graphicType = args[graphicIdx + 1] as GraphicType
    const fixtureName = args[fixtureIdx + 1]
    const width = widthIdx >= 0 ? parseInt(args[widthIdx + 1]) : 400
    const height = heightIdx >= 0 ? parseInt(args[heightIdx + 1]) : 200

    if (!getAvailableGraphics().includes(graphicType)) {
        console.log(`Unknown graphic type: ${graphicType}`)
        console.log('Available:', getAvailableGraphics().join(', '))
        process.exit(1)
    }

    testGraphic(graphicType, fixtureName, { width, height, verbose, skipJudge })
        .then(result => {
            console.log('\n=== Result ===')
            console.log(`Graphic: ${result.graphicType}`)
            console.log(`Fixture: ${result.fixtureName}`)
            console.log(`Image: ${result.imagePath}`)
            console.log(`Score: ${result.score}`)
            console.log(`Status: ${result.pass ? 'PASS' : 'FAIL'}`)
            console.log(`Duration: ${result.duration}ms`)
            if (result.error) {
                console.log(`Error: ${result.error}`)
            }
            if (result.judgment?.suggestions) {
                console.log('\nSuggestions:')
                result.judgment.suggestions.forEach(s => console.log(`  - ${s}`))
            }
            process.exit(result.pass ? 0 : 1)
        })
        .catch(err => {
            console.error('Error:', err)
            process.exit(1)
        })
}
