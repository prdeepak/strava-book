/**
 * Generate a splits chart visualization as React components for PDF embedding
 * This creates chart elements that can be rendered in react-pdf templates
 */

import { ReactElement } from 'react'

export type SplitData = {
    split: number
    label: string
    moving_time: number
    distance: number
    elevation_difference: number
}

export type ChartOptions = {
    width: number
    height: number
    showMilestones?: boolean
    showElevation?: boolean
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
    const { width, height } = options

    if (splits.length === 0) {
        return null
    }

    // Chart dimensions
    const padding = { top: 20, right: 5, bottom: 20, left: 25 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom
    const elevHeight = 15
    const paceHeight = plotHeight - elevHeight

    // Calculate pace values
    const paces = splits.map(s => s.moving_time / (s.distance / 1000))
    const minPace = Math.min(...paces)
    const maxPace = Math.max(...paces)
    const paceRange = maxPace - minPace || 1

    // Calculate elevation values
    const elevations = splits.map(s => s.elevation_difference)
    const minElev = Math.min(...elevations)
    const maxElev = Math.max(...elevations)
    const elevRange = Math.max(Math.abs(minElev), Math.abs(maxElev)) || 1

    // Calculate total distance for proportional widths
    const totalDistance = splits.reduce((sum, s) => sum + s.distance, 0)

    // Calculate bar positions and widths (proportional to distance)
    let currentX = padding.left
    const barData = splits.map(split => {
        const barWidth = (split.distance / totalDistance) * plotWidth
        const x = currentX
        currentX += barWidth
        return { x, width: barWidth, split }
    })

    // Pace scale ticks
    const paceTickCount = 3
    const paceStep = paceRange / (paceTickCount - 1)
    const paceTicks = Array.from({ length: paceTickCount }).map((_, i) => {
        const pace = maxPace - (i * paceStep)
        const y = padding.top + (i / (paceTickCount - 1)) * paceHeight
        const mins = Math.floor(pace / 60)
        const secs = Math.round(pace % 60)
        const label = `${mins}:${secs.toString().padStart(2, '0')}`
        return { y, label, pace }
    })

    // Calculate cumulative elevation for absolute altitude
    let cumulativeElev = 0
    const absoluteElevations = splits.map(s => {
        cumulativeElev += s.elevation_difference
        return cumulativeElev
    })
    const minAbsElev = Math.min(0, ...absoluteElevations)
    const maxAbsElev = Math.max(0, ...absoluteElevations)

    // Elevation scale ticks (absolute altitude)
    const elevTicks = [
        { value: maxAbsElev, label: `${Math.round(maxAbsElev)}m` },
        { value: minAbsElev, label: `${Math.round(minAbsElev)}m` }
    ]

    return {
        dimensions: { width, height, padding, plotWidth, plotHeight, paceHeight, elevHeight },
        paceData: { minPace, maxPace, paceRange, paceTicks },
        elevData: { minElev, maxElev, elevRange, elevTicks },
        barData,
        totalDistance
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
