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
    showElevation?: boolean
    baseElevation?: number  // Starting elevation above sea level
}

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
    const { width, height, baseElevation } = options

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
    const elevHeight = Math.min(30, plotHeight * 0.25)  // 25% of plot height for elevation
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

    // X-axis lap labels
    const lapLabels = splits.map((split, index) => {
        const bar = barData[index]
        return {
            x: bar.x + bar.width / 2,
            label: `${index + 1}`,
            y: padding.top + plotHeight + 12
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
        axes
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
