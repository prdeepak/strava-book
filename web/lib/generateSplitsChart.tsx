/**
 * Generate a splits chart visualization as React components for PDF embedding
 * This creates chart elements that can be rendered in react-pdf templates
 * 
 * Design matches Strava's splits chart:
 * - Bars proportional to split/lap distance
 * - Absolute elevation above sea level
 * - X-axis with lap numbers
 * - Progress markers at 25%, 50%, 75%
 * - Finish flag with final time
 */

import { ReactElement } from 'react'
import { Svg, Polyline, View, Text } from '@react-pdf/renderer'
import { BookTheme, DEFAULT_THEME } from './book-types'
import { resolveChartColors } from './typography'

export type SplitData = {
    split: number  // Split/lap number
    label: string
    moving_time: number
    distance: number
    elevation_difference: number  // For splits or total_elevation_gain for laps
}

export type ChartOptions = {
    width: number
    height: number
    showMilestones?: boolean
    /** Whether to include elevation profile section. Default: true */
    showElevation?: boolean
    baseElevation?: number  // Starting elevation above sea level
}

// Internal type for chart options with defaults applied - available if needed
// type ChartOptionsResolved = Required<Omit<ChartOptions, 'baseElevation'>> & { baseElevation?: number }

export type ProgressMarker = {
    x: number
    percentage: number
    time: string
    distance: number
}

export type ChartElements = {
    background: ReactElement
    yAxis: ReactElement
    paceLabels: ReactElement[]
    elevationProfile: ReactElement
    paceBars: ReactElement[]
    elevationLabels: ReactElement[]
}

/**
 * Generate chart data and elements for rendering
 */
export function generateSplitsChartData(
    splits: SplitData[],
    totalTime: number,
    options: ChartOptions
) {
    const { width, height, baseElevation, showElevation = true } = options

    if (splits.length === 0) {
        return null
    }

    // Calculate smart base elevation if not provided
    // Strategy: Find the minimum cumulative elevation and use that as baseline
    let calculatedBaseElevation = baseElevation
    if (calculatedBaseElevation === undefined) {
        let cumulative = 0
        let minCumulative = 0
        splits.forEach(s => {
            cumulative += s.elevation_difference
            if (cumulative < minCumulative) {
                minCumulative = cumulative
            }
        })
        // Set base so minimum point is at reasonable altitude (e.g., 0m or close to it)
        calculatedBaseElevation = Math.abs(minCumulative)
    }

    // Chart dimensions - adjusted for axes
    const padding = { top: 25, right: 40, bottom: 30, left: 40 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    // When elevation is hidden, use full height for pace bars
    const elevHeight = showElevation ? Math.min(30, plotHeight * 0.25) : 0
    const paceHeight = plotHeight - elevHeight

    // Calculate pace values
    const paces = splits.map(s => s.moving_time / (s.distance / 1000))
    const minPace = Math.min(...paces)
    const maxPace = Math.max(...paces)
    const paceRange = maxPace - minPace || 1

    // Calculate absolute elevation values
    let cumulativeElev = calculatedBaseElevation
    const absoluteElevations = splits.map(s => {
        cumulativeElev += s.elevation_difference
        return cumulativeElev
    })

    const minAbsElev = Math.min(calculatedBaseElevation, ...absoluteElevations)
    const maxAbsElev = Math.max(calculatedBaseElevation, ...absoluteElevations)
    const elevRange = maxAbsElev - minAbsElev || 1

    // Calculate total distance for proportional widths
    const totalDistance = splits.reduce((sum, s) => sum + s.distance, 0)

    // Calculate bar positions and widths (proportional to distance)
    let currentX = padding.left
    let cumulativeTime = 0
    const barData = splits.map((split, index) => {
        const barWidth = (split.distance / totalDistance) * plotWidth
        const x = currentX
        currentX += barWidth
        cumulativeTime += split.moving_time

        return {
            x,
            width: barWidth,
            split,
            cumulativeTime,
            cumulativeDistance: splits.slice(0, index + 1).reduce((sum, s) => sum + s.distance, 0),
            absoluteElevation: absoluteElevations[index]
        }
    })

    // Pace scale ticks (3 ticks: max, mid, min)
    const paceTickCount = 3
    const paceStep = paceRange / (paceTickCount - 1)
    const paceTicks = Array.from({ length: paceTickCount }).map((_, i) => {
        const pace = maxPace - (i * paceStep)
        const y = padding.top + (i / (paceTickCount - 1)) * paceHeight
        const mins = Math.floor(pace / 60)
        const secs = Math.round(pace % 60)
        const label = `${mins}:${secs.toString().padStart(2, '0')}/km`
        return { y, label, pace }
    })

    // Elevation scale ticks (absolute altitude) - 3 ticks evenly spaced
    const elevTickCount = 3
    const elevStep = elevRange / (elevTickCount - 1)
    const elevTicks = Array.from({ length: elevTickCount }).map((_, i) => {
        const value = minAbsElev + (i * elevStep)
        const elevY = padding.top + paceHeight
        const y = elevY + elevHeight - (i / (elevTickCount - 1)) * elevHeight
        return {
            value,
            label: `${Math.round(value)} m`,
            y
        }
    })

    // Progress markers at 25%, 50%, 75%
    const progressMarkers: ProgressMarker[] = [0.25, 0.5, 0.75].map(percentage => {
        const targetDistance = totalDistance * percentage
        let cumulativeDist = 0
        let markerTime = 0

        // Find which split contains this percentage
        for (const split of splits) {
            if (cumulativeDist + split.distance >= targetDistance) {
                // Interpolate time within this split
                const distanceIntoSplit = targetDistance - cumulativeDist
                const timeIntoSplit = (distanceIntoSplit / split.distance) * split.moving_time
                markerTime += timeIntoSplit
                break
            }
            cumulativeDist += split.distance
            markerTime += split.moving_time
        }

        const x = padding.left + (percentage * plotWidth)
        const hours = Math.floor(markerTime / 3600)
        const mins = Math.floor((markerTime % 3600) / 60)
        const secs = Math.round(markerTime % 60)
        const time = hours > 0
            ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${mins}:${secs.toString().padStart(2, '0')}`

        return { x, percentage, time, distance: targetDistance / 1000 }
    })

    // Finish marker (100%) - positioned at right edge, flag flies left
    const finishX = padding.left + plotWidth
    const hours = Math.floor(totalTime / 3600)
    const mins = Math.floor((totalTime % 3600) / 60)
    const secs = Math.round(totalTime % 60)
    const finishTime = hours > 0
        ? `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins}:${secs.toString().padStart(2, '0')}`

    const finishMarker = {
        x: finishX,
        time: finishTime,
        distance: totalDistance / 1000
    }

    // X-axis lap labels - reduce number of labels for ultramarathons/many splits
    // Show every Nth label to prevent overlap based on number of splits
    const labelInterval = splits.length > 30 ? 10 : splits.length > 15 ? 5 : splits.length > 8 ? 2 : 1
    const lapLabels = splits.map((split, index) => {
        const bar = barData[index]
        // Only show label at intervals to prevent overlap
        const showLabel = (index + 1) % labelInterval === 0 || index === 0 || index === splits.length - 1
        return {
            x: bar.x + bar.width / 2,
            label: showLabel ? `${index + 1}` : '',
            y: padding.top + plotHeight + 12,
            showLabel
        }
    })

    // Axes data
    const axes = {
        // Left Y-axis (pace)
        paceAxis: {
            x1: padding.left,
            y1: padding.top,
            x2: padding.left,
            y2: padding.top + paceHeight
        },
        // Right Y-axis (elevation)
        elevAxis: {
            x1: padding.left + plotWidth,
            y1: padding.top + paceHeight,
            x2: padding.left + plotWidth,
            y2: padding.top + paceHeight + elevHeight
        },
        // Bottom X-axis
        xAxis: {
            x1: padding.left,
            y1: padding.top + plotHeight,
            x2: padding.left + plotWidth,
            y2: padding.top + plotHeight
        }
    }

    return {
        dimensions: { width, height, padding, plotWidth, plotHeight, paceHeight, elevHeight },
        paceData: { minPace, maxPace, paceRange, paceTicks },
        elevData: { minElev: minAbsElev, maxElev: maxAbsElev, elevRange, elevTicks, absoluteElevations },
        barData,
        totalDistance,
        progressMarkers,
        finishMarker,
        lapLabels,
        axes,
        showElevation
    }
}

/**
 * Format pace value as min:sec string
 */
export function formatPace(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format elevation value as string with sign
 */
export function formatElevation(meters: number): string {
    const rounded = Math.round(meters)
    return rounded >= 0 ? `+${rounded}m` : `${rounded}m`
}

/**
 * Format time as HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.round(seconds % 60)

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Reusable SVG Chart Component
 * Renders the complete splits/laps chart with all elements
 */
export function SplitsChartSVG({
    splits,
    totalTime,
    width,
    height,
    backgroundColor = 'white',
    showElevation = false,
    theme = DEFAULT_THEME
}: {
    splits: SplitData[]
    totalTime: number
    width: number
    height: number
    backgroundColor?: string
    /** Whether to show the elevation profile at the bottom of the chart. Default: false */
    showElevation?: boolean
    /** Theme for chart colors */
    theme?: BookTheme
}) {
    const chartData = generateSplitsChartData(splits, totalTime, { width, height, showElevation })

    if (!chartData) return null

    const { dimensions, paceData, elevData, barData, lapLabels, progressMarkers, finishMarker, axes, showElevation: includeElevation } = chartData
    const { padding, paceHeight, plotWidth, elevHeight } = dimensions

    // Get chart colors from theme
    const colors = resolveChartColors(theme)

    // Calculate font sizes based on chart size (smaller charts = smaller fonts)
    // Using larger sizes for better readability
    const baseFontSize = width < 300 ? 6 : 8
    const labelFontSize = baseFontSize
    const markerTimeFontSize = baseFontSize + 2  // Larger for progress marker times
    const markerPercentFontSize = baseFontSize   // Percentage labels
    const finishFontSize = baseFontSize + 2
    const flagWidth = width < 300 ? 30 : 50

    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ backgroundColor }}>
            {/* Background */}
            <Polyline points={`0,0 ${width},0 ${width},${height} 0,${height}`} fill={backgroundColor} stroke="none" />

            {/* Axes */}
            <Polyline points={`${axes.paceAxis.x1},${axes.paceAxis.y1} ${axes.paceAxis.x2},${axes.paceAxis.y2}`} stroke={colors.axisLine} strokeWidth="1.5" fill="none" />
            {includeElevation && <Polyline points={`${axes.elevAxis.x1},${axes.elevAxis.y1} ${axes.elevAxis.x2},${axes.elevAxis.y2}`} stroke={colors.axisLine} strokeWidth="1.5" fill="none" />}
            <Polyline points={`${axes.xAxis.x1},${axes.xAxis.y1} ${axes.xAxis.x2},${axes.xAxis.y2}`} stroke={colors.axisLine} strokeWidth="1.5" fill="none" />

            {/* Pace labels */}
            {paceData.paceTicks.map((tick, i) => (
                <View key={`pace-${i}`}>
                    <Polyline points={`${padding.left - 4},${tick.y} ${padding.left},${tick.y}`} stroke={colors.axisLine} strokeWidth="0.5" fill="none" />
                    <Svg>
                        <Text x={padding.left - 6} y={tick.y + 2} style={{ fontSize: labelFontSize, fontFamily: 'Helvetica', fill: colors.axisLabel }} textAnchor="end">
                            {tick.label}
                        </Text>
                    </Svg>
                </View>
            ))}

            {/* Elevation labels - only shown when elevation profile is enabled */}
            {includeElevation && elevData.elevTicks.map((tick, i) => (
                <View key={`elev-${i}`}>
                    <Polyline points={`${padding.left + plotWidth},${tick.y} ${padding.left + plotWidth + 4},${tick.y}`} stroke={colors.axisLine} strokeWidth="0.5" fill="none" />
                    <Svg>
                        <Text x={padding.left + plotWidth + 6} y={tick.y + 2} style={{ fontSize: labelFontSize, fontFamily: 'Helvetica', fill: colors.axisLabel }} textAnchor="start">
                            {tick.label}
                        </Text>
                    </Svg>
                </View>
            ))}

            {/* Horizontal grid lines for pace comparison */}
            {paceData.paceTicks.map((tick, i) => (
                <Polyline
                    key={`grid-${i}`}
                    points={`${padding.left},${tick.y} ${padding.left + plotWidth},${tick.y}`}
                    stroke={colors.gridLine}
                    strokeWidth="0.5"
                    strokeDasharray="2,2"
                    fill="none"
                />
            ))}

            {/* Lap labels - only show labels that have content */}
            {lapLabels && lapLabels.filter(label => label.showLabel).map((label, i) => (
                <Svg key={`lap-${i}`}>
                    <Text x={label.x} y={label.y} style={{ fontSize: labelFontSize + 1, fontFamily: 'Helvetica', fill: colors.axisLabel }} textAnchor="middle">
                        {label.label}
                    </Text>
                </Svg>
            ))}

            {/* Elevation profile - filled area (absolute altitude) - only shown when enabled */}
            {includeElevation && (() => {
                const elevY = padding.top + paceHeight
                let elevPoints = `${padding.left},${elevY + elevHeight}`

                barData.forEach((bar) => {
                    const x = bar.x + bar.width / 2
                    const elevNorm = (bar.absoluteElevation - elevData.minElev) / elevData.elevRange
                    const y = elevY + elevHeight - (elevNorm * elevHeight * 0.9)
                    elevPoints += ` ${x},${y}`
                })

                elevPoints += ` ${padding.left + plotWidth},${elevY + elevHeight}`

                return <Polyline points={elevPoints} fill={colors.elevationFill} stroke={colors.elevationStroke} strokeWidth="1" />
            })()}

            {/* Pace bars - using Strava-style light blue */}
            {barData.map((bar, i) => {
                const paceSeconds = bar.split.moving_time / (bar.split.distance / 1000)
                const paceNorm = (paceSeconds - paceData.minPace) / paceData.paceRange
                const barHeight = paceNorm * paceHeight * 0.7 + paceHeight * 0.15
                const y = padding.top + paceHeight - barHeight

                return (
                    <Polyline
                        key={i}
                        points={`${bar.x},${y} ${bar.x + bar.width - 0.5},${y} ${bar.x + bar.width - 0.5},${padding.top + paceHeight} ${bar.x},${padding.top + paceHeight}`}
                        fill={colors.barFill}
                        stroke={colors.barStroke}
                        strokeWidth="0.5"
                    />
                )
            })}

            {/* Progress markers with dashed lines and larger text */}
            {progressMarkers && progressMarkers.map((marker, i) => (
                <View key={`progress-${i}`}>
                    <Polyline
                        points={`${marker.x},${padding.top} ${marker.x},${padding.top + paceHeight}`}
                        stroke={colors.markerLine}
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        fill="none"
                    />
                    <Svg>
                        {/* Time at marker - larger and more prominent */}
                        <Text x={marker.x} y={padding.top - 6} style={{ fontSize: markerTimeFontSize, fontFamily: 'Helvetica-Bold', fill: colors.markerText }} textAnchor="middle">
                            {marker.time}
                        </Text>
                        {/* Percentage label above time */}
                        <Text x={marker.x} y={padding.top - 18} style={{ fontSize: markerPercentFontSize, fontFamily: 'Helvetica', fill: colors.axisLabel }} textAnchor="middle">
                            {Math.round(marker.percentage * 100)}%
                        </Text>
                    </Svg>
                </View>
            ))}

            {/* Finish flag - flying left with prominent styling */}
            {finishMarker && (
                <View>
                    <Polyline points={`${finishMarker.x},${padding.top} ${finishMarker.x},${padding.top + paceHeight}`} stroke={theme.primaryColor} strokeWidth="2" fill="none" />
                    <Polyline points={`${finishMarker.x - flagWidth},${padding.top - 4} ${finishMarker.x},${padding.top - 4} ${finishMarker.x},${padding.top - 20} ${finishMarker.x - flagWidth},${padding.top - 20}`} fill={theme.primaryColor} stroke="none" />
                    <Svg>
                        <Text x={finishMarker.x - flagWidth / 2} y={padding.top - 10} style={{ fontSize: finishFontSize, fontFamily: 'Helvetica-Bold', fill: theme.backgroundColor }} textAnchor="middle">
                            {finishMarker.time}
                        </Text>
                    </Svg>
                </View>
            )}
        </Svg>
    )
}
