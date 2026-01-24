/**
 * Generate an elevation profile visualization as React components for PDF embedding
 * This creates a standalone elevation chart that can be rendered in react-pdf templates
 *
 * Features:
 * - Smooth elevation curve showing altitude changes
 * - Fill area under the curve for visual impact
 * - Y-axis with elevation values (meters)
 * - X-axis with distance markers
 * - Min/max elevation labels
 * - Total gain/loss display
 * - Professional color scheme with gradient-like appearance
 */

import React from 'react'
import { Svg, Polyline, Text, Rect, Line, G } from '@react-pdf/renderer'

export type ElevationPoint = {
    distance: number  // Cumulative distance in meters
    elevation: number // Elevation in meters (can be relative or absolute)
}

export type ElevationData = {
    points: ElevationPoint[]
    totalGain: number
    totalLoss: number
    minElevation: number
    maxElevation: number
    totalDistance: number
}

export type ElevationProfileOptions = {
    width: number
    height: number
    fillColor?: string
    strokeColor?: string
    backgroundColor?: string
    showGrid?: boolean
    showStats?: boolean
}

/**
 * Convert splits data to elevation points
 */
export function splitsToElevationData(
    splits: Array<{
        distance: number
        elevation_difference: number
    }>,
    baseElevation: number = 0
): ElevationData {
    let cumulativeDistance = 0
    let cumulativeElevation = baseElevation
    let totalGain = 0
    let totalLoss = 0

    const points: ElevationPoint[] = [
        { distance: 0, elevation: baseElevation }
    ]

    splits.forEach(split => {
        cumulativeDistance += split.distance
        cumulativeElevation += split.elevation_difference

        if (split.elevation_difference > 0) {
            totalGain += split.elevation_difference
        } else {
            totalLoss += Math.abs(split.elevation_difference)
        }

        points.push({
            distance: cumulativeDistance,
            elevation: cumulativeElevation
        })
    })

    const elevations = points.map(p => p.elevation)
    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)

    return {
        points,
        totalGain,
        totalLoss,
        minElevation,
        maxElevation,
        totalDistance: cumulativeDistance
    }
}

/**
 * Generate nice round tick values for axes
 */
function generateNiceScale(min: number, max: number, tickCount: number): number[] {
    const range = max - min
    const roughStep = range / (tickCount - 1)

    // Find a nice step value (1, 2, 5, 10, 20, 50, 100, 200, 500, ...)
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
    const residual = roughStep / magnitude
    let niceStep: number

    if (residual <= 1.5) niceStep = magnitude
    else if (residual <= 3) niceStep = 2 * magnitude
    else if (residual <= 7) niceStep = 5 * magnitude
    else niceStep = 10 * magnitude

    const niceMin = Math.floor(min / niceStep) * niceStep
    const niceMax = Math.ceil(max / niceStep) * niceStep

    const ticks: number[] = []
    for (let v = niceMin; v <= niceMax; v += niceStep) {
        ticks.push(v)
    }

    return ticks
}

/**
 * Format distance for display
 */
function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(0)} km`
    }
    return `${meters.toFixed(0)} m`
}

/**
 * Format elevation for display
 */
function formatElevation(meters: number): string {
    return `${Math.round(meters)} m`
}

/**
 * Reusable SVG Elevation Profile Component
 * Renders the elevation chart with all elements
 */
export function ElevationProfileSVG({
    data,
    width,
    height,
    fillColor = '#3b82f6',
    strokeColor = '#1d4ed8',
    backgroundColor = 'white',
    showGrid = true,
    showStats = true
}: {
    data: ElevationData
    width: number
    height: number
    fillColor?: string
    strokeColor?: string
    backgroundColor?: string
    showGrid?: boolean
    showStats?: boolean
}) {
    if (!data || data.points.length < 2) return null

    // Chart dimensions with padding for labels
    const padding = { top: 25, right: 50, bottom: 35, left: 50 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    // Calculate scales
    const { minElevation, maxElevation, totalDistance, points } = data
    const elevRange = maxElevation - minElevation || 1

    // Add 10% padding to elevation range for visual breathing room
    const elevPadding = elevRange * 0.1
    const displayMinElev = minElevation - elevPadding
    const displayMaxElev = maxElevation + elevPadding
    const displayElevRange = displayMaxElev - displayMinElev

    // Generate tick marks
    const elevTicks = generateNiceScale(minElevation, maxElevation, 4)
    const distTicks = generateNiceScale(0, totalDistance, 5)

    // Convert data points to SVG coordinates
    const svgPoints = points.map(p => ({
        x: padding.left + (p.distance / totalDistance) * plotWidth,
        y: padding.top + plotHeight - ((p.elevation - displayMinElev) / displayElevRange) * plotHeight
    }))

    // Create the path for the filled area
    let fillPoints = `${padding.left},${padding.top + plotHeight}`
    svgPoints.forEach(p => {
        fillPoints += ` ${p.x.toFixed(2)},${p.y.toFixed(2)}`
    })
    fillPoints += ` ${padding.left + plotWidth},${padding.top + plotHeight}`

    // Create smooth curve points string for stroke
    const curvePoints = svgPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

    // Font sizes based on chart size
    const baseFontSize = width < 300 ? 6 : 8
    const labelFontSize = baseFontSize
    const statsFontSize = baseFontSize + 1

    // Calculate stats display position
    const statsY = padding.top + 8

    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Background */}
            <Rect x="0" y="0" width={String(width)} height={String(height)} fill={backgroundColor} />

            {/* Horizontal grid lines */}
            {showGrid && elevTicks.map((tick, i) => {
                const y = padding.top + plotHeight - ((tick - displayMinElev) / displayElevRange) * plotHeight
                if (y < padding.top || y > padding.top + plotHeight) return null
                return (
                    <Line
                        key={`h-grid-${i}`}
                        x1={String(padding.left)}
                        y1={String(y.toFixed(2))}
                        x2={String(padding.left + plotWidth)}
                        y2={String(y.toFixed(2))}
                        stroke="#e5e7eb"
                        strokeWidth="0.5"
                    />
                )
            })}

            {/* Vertical grid lines */}
            {showGrid && distTicks.map((tick, i) => {
                const x = padding.left + (tick / totalDistance) * plotWidth
                if (x < padding.left || x > padding.left + plotWidth) return null
                return (
                    <Line
                        key={`v-grid-${i}`}
                        x1={String(x.toFixed(2))}
                        y1={String(padding.top)}
                        x2={String(x.toFixed(2))}
                        y2={String(padding.top + plotHeight)}
                        stroke="#e5e7eb"
                        strokeWidth="0.5"
                    />
                )
            })}

            {/* Filled area under curve */}
            <Polyline
                points={fillPoints}
                fill={fillColor}
                fillOpacity="0.3"
                stroke="none"
            />

            {/* Elevation profile line */}
            <Polyline
                points={curvePoints}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Y-axis (elevation) */}
            <Line
                x1={String(padding.left)}
                y1={String(padding.top)}
                x2={String(padding.left)}
                y2={String(padding.top + plotHeight)}
                stroke="#374151"
                strokeWidth="1"
            />

            {/* X-axis (distance) */}
            <Line
                x1={String(padding.left)}
                y1={String(padding.top + plotHeight)}
                x2={String(padding.left + plotWidth)}
                y2={String(padding.top + plotHeight)}
                stroke="#374151"
                strokeWidth="1"
            />

            {/* Y-axis labels (elevation) */}
            {elevTicks.map((tick, i) => {
                const y = padding.top + plotHeight - ((tick - displayMinElev) / displayElevRange) * plotHeight
                if (y < padding.top - 5 || y > padding.top + plotHeight + 5) return null
                return (
                    <G key={`elev-label-${i}`}>
                        <Line
                            x1={String(padding.left - 4)}
                            y1={String(y.toFixed(2))}
                            x2={String(padding.left)}
                            y2={String(y.toFixed(2))}
                            stroke="#374151"
                            strokeWidth="0.5"
                        />
                        <Text
                            x={padding.left - 6}
                            y={y + 3}
                            style={{
                                fontSize: labelFontSize,
                                fontFamily: 'Helvetica',
                                fill: '#6b7280'
                            }}
                            textAnchor="end"
                        >
                            {formatElevation(tick)}
                        </Text>
                    </G>
                )
            })}

            {/* X-axis labels (distance) */}
            {distTicks.map((tick, i) => {
                const x = padding.left + (tick / totalDistance) * plotWidth
                if (x < padding.left - 10 || x > padding.left + plotWidth + 10) return null
                return (
                    <G key={`dist-label-${i}`}>
                        <Line
                            x1={String(x.toFixed(2))}
                            y1={String(padding.top + plotHeight)}
                            x2={String(x.toFixed(2))}
                            y2={String(padding.top + plotHeight + 4)}
                            stroke="#374151"
                            strokeWidth="0.5"
                        />
                        <Text
                            x={x}
                            y={padding.top + plotHeight + 14}
                            style={{
                                fontSize: labelFontSize,
                                fontFamily: 'Helvetica',
                                fill: '#6b7280'
                            }}
                            textAnchor="middle"
                        >
                            {formatDistance(tick)}
                        </Text>
                    </G>
                )
            })}

            {/* Min/Max elevation markers */}
            {(() => {
                // Find min and max points
                let minPoint = svgPoints[0]
                let maxPoint = svgPoints[0]
                let minIdx = 0
                let maxIdx = 0

                svgPoints.forEach((p, i) => {
                    if (p.y > minPoint.y) { // Higher y = lower elevation
                        minPoint = p
                        minIdx = i
                    }
                    if (p.y < maxPoint.y) { // Lower y = higher elevation
                        maxPoint = p
                        maxIdx = i
                    }
                })

                return (
                    <>
                        {/* Max elevation marker */}
                        <Rect
                            x={String((maxPoint.x - 3).toFixed(2))}
                            y={String((maxPoint.y - 3).toFixed(2))}
                            width="6"
                            height="6"
                            fill={strokeColor}
                        />
                        <Text
                            x={maxPoint.x}
                            y={maxPoint.y - 8}
                            style={{
                                fontSize: labelFontSize,
                                fontFamily: 'Helvetica-Bold',
                                fill: strokeColor
                            }}
                            textAnchor="middle"
                        >
                            {formatElevation(maxElevation)}
                        </Text>

                        {/* Min elevation marker (only if different position) */}
                        {Math.abs(minIdx - maxIdx) > 1 && (
                            <>
                                <Rect
                                    x={String((minPoint.x - 3).toFixed(2))}
                                    y={String((minPoint.y - 3).toFixed(2))}
                                    width="6"
                                    height="6"
                                    fill="#ef4444"
                                />
                                <Text
                                    x={minPoint.x}
                                    y={minPoint.y + 12}
                                    style={{
                                        fontSize: labelFontSize,
                                        fontFamily: 'Helvetica-Bold',
                                        fill: '#ef4444'
                                    }}
                                    textAnchor="middle"
                                >
                                    {formatElevation(minElevation)}
                                </Text>
                            </>
                        )}
                    </>
                )
            })()}

            {/* Stats display (gain/loss) */}
            {showStats && (
                <>
                    {/* Gain indicator */}
                    <G>
                        <Rect
                            x={String(padding.left)}
                            y={String(statsY - 8)}
                            width="8"
                            height="8"
                            fill="#22c55e"
                        />
                        <Text
                            x={padding.left + 12}
                            y={statsY}
                            style={{
                                fontSize: statsFontSize,
                                fontFamily: 'Helvetica-Bold',
                                fill: '#22c55e'
                            }}
                        >
                            +{Math.round(data.totalGain)} m
                        </Text>
                    </G>

                    {/* Loss indicator */}
                    <G>
                        <Rect
                            x={String(padding.left + 70)}
                            y={String(statsY - 8)}
                            width="8"
                            height="8"
                            fill="#ef4444"
                        />
                        <Text
                            x={padding.left + 82}
                            y={statsY}
                            style={{
                                fontSize: statsFontSize,
                                fontFamily: 'Helvetica-Bold',
                                fill: '#ef4444'
                            }}
                        >
                            -{Math.round(data.totalLoss)} m
                        </Text>
                    </G>

                    {/* Axis label */}
                    <Text
                        x={width - padding.right}
                        y={statsY}
                        style={{
                            fontSize: labelFontSize,
                            fontFamily: 'Helvetica',
                            fill: '#9ca3af'
                        }}
                        textAnchor="end"
                    >
                        Elevation Profile
                    </Text>
                </>
            )}

            {/* X-axis title */}
            <Text
                x={padding.left + plotWidth / 2}
                y={height - 5}
                style={{
                    fontSize: labelFontSize,
                    fontFamily: 'Helvetica',
                    fill: '#6b7280'
                }}
                textAnchor="middle"
            >
                Distance
            </Text>
        </Svg>
    )
}

/**
 * Convenience wrapper that takes splits data directly
 */
export function ElevationProfileFromSplits({
    splits,
    baseElevation = 0,
    ...options
}: {
    splits: Array<{
        distance: number
        elevation_difference: number
    }>
    baseElevation?: number
} & ElevationProfileOptions) {
    const data = splitsToElevationData(splits, baseElevation)
    return <ElevationProfileSVG data={data} {...options} />
}
