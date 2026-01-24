/**
 * RaceDataViz - Composable race data visualization container
 *
 * Renders splits chart and/or elevation profile in a stacked layout.
 * Each visualization is independent and can be shown/hidden.
 *
 * Usage:
 *   <RaceDataViz
 *     splits={activity.splits_metric}
 *     totalTime={activity.moving_time}
 *     width={contentWidth}
 *     height={120}
 *     showSplits={true}
 *     showElevation={true}
 *   />
 */

import { View, StyleSheet } from '@react-pdf/renderer'
import { SplitsChartSVG, SplitData } from '@/lib/generateSplitsChart'
import { ElevationProfileFromSplits } from '@/lib/generateElevationProfile'
import { BookTheme, DEFAULT_THEME } from '@/lib/book-types'

export interface RaceDataVizProps {
    /** Splits/laps data for both charts */
    splits: Array<{
        split?: number
        lap_index?: number
        name?: string
        moving_time: number
        distance: number
        elevation_difference: number
    }>
    /** Total activity time in seconds */
    totalTime: number
    /** Container width */
    width: number
    /** Total container height (divided between charts) */
    height: number
    /** Show splits/pace chart */
    showSplits?: boolean
    /** Show elevation profile */
    showElevation?: boolean
    /** Gap between charts when both shown */
    gap?: number
    /** Theme for colors (future use) */
    theme?: BookTheme
    /** Background color */
    backgroundColor?: string
}

export function RaceDataViz({
    splits,
    totalTime,
    width,
    height,
    showSplits = true,
    showElevation = true,
    gap = 8,
    theme = DEFAULT_THEME,
    backgroundColor = 'transparent'
}: RaceDataVizProps) {
    // Don't render if no data or nothing to show
    if (!splits || splits.length === 0 || (!showSplits && !showElevation)) {
        return null
    }

    // Convert to SplitData format for SplitsChartSVG
    const splitData: SplitData[] = splits.map((s, i) => ({
        split: s.split ?? s.lap_index ?? i + 1,
        label: s.name ?? `${i + 1}`,
        moving_time: s.moving_time,
        distance: s.distance,
        elevation_difference: s.elevation_difference
    }))

    // Calculate heights based on what's shown
    const showBoth = showSplits && showElevation
    const actualGap = showBoth ? gap : 0
    const availableHeight = height - actualGap

    // When showing both, splits get 60%, elevation gets 40%
    // When showing one, it gets full height
    const splitsHeight = showBoth
        ? Math.round(availableHeight * 0.6)
        : (showSplits ? availableHeight : 0)
    const elevationHeight = showBoth
        ? availableHeight - splitsHeight
        : (showElevation ? availableHeight : 0)

    const styles = StyleSheet.create({
        container: {
            width,
            height,
            backgroundColor,
        },
        splitsContainer: {
            width,
            height: splitsHeight,
        },
        gap: {
            height: actualGap,
        },
        elevationContainer: {
            width,
            height: elevationHeight,
        }
    })

    return (
        <View style={styles.container}>
            {showSplits && splitsHeight > 0 && (
                <View style={styles.splitsContainer}>
                    <SplitsChartSVG
                        splits={splitData}
                        totalTime={totalTime}
                        width={width}
                        height={splitsHeight}
                        backgroundColor={backgroundColor === 'transparent' ? 'white' : backgroundColor}
                        showElevation={false}
                    />
                </View>
            )}

            {showBoth && <View style={styles.gap} />}

            {showElevation && elevationHeight > 0 && (
                <View style={styles.elevationContainer}>
                    <ElevationProfileFromSplits
                        splits={splitData}
                        width={width}
                        height={elevationHeight}
                        backgroundColor={backgroundColor === 'transparent' ? 'white' : backgroundColor}
                        showGrid={true}
                        showStats={true}
                    />
                </View>
            )}
        </View>
    )
}

export default RaceDataViz
