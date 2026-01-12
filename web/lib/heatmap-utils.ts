/**
 * Heatmap utilities for calendar visualization
 *
 * Provides functions for generating calendar cells and color intensity
 * based on activity data. Used by YearCalendar template.
 */

import { StravaActivity } from './strava'

/**
 * Calendar cell data structure
 */
export interface CalendarCell {
  date: string           // ISO date string YYYY-MM-DD
  dayOfMonth: number     // 1-31
  dayOfWeek: number      // 0-6 (Sunday-Saturday)
  weekOfMonth: number    // 0-5
  value: number          // Aggregated metric value
  intensity: number      // 0-4 color intensity level
  hasActivity: boolean
}

/**
 * Month calendar data structure
 */
export interface MonthCalendar {
  year: number
  month: number          // 0-11
  monthName: string
  monthNameShort: string
  cells: CalendarCell[]
  totalActivities: number
  totalValue: number
}

/**
 * Color by metric types
 */
export type ColorByMetric = 'distance' | 'time' | 'count' | 'elevation'

export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Get number of days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Get the day of week for the first day of a month (0 = Sunday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/**
 * Aggregate activities by date into a value map
 */
export function aggregateActivitiesByDate(
  activities: StravaActivity[],
  colorBy: ColorByMetric
): Map<string, number> {
  const dateMap = new Map<string, number>()

  activities.forEach(activity => {
    const dateStr = activity.start_date_local
      ? new Date(activity.start_date_local).toISOString().split('T')[0]
      : new Date(activity.start_date).toISOString().split('T')[0]

    const currentValue = dateMap.get(dateStr) || 0

    let value = 0
    switch (colorBy) {
      case 'distance':
        value = (activity.distance || 0) / 1000 // km
        break
      case 'time':
        value = (activity.moving_time || 0) / 3600 // hours
        break
      case 'count':
        value = 1
        break
      case 'elevation':
        value = activity.total_elevation_gain || 0
        break
    }

    dateMap.set(dateStr, currentValue + value)
  })

  return dateMap
}

/**
 * Calculate color intensity (0-4 scale like GitHub contributions)
 */
export function getColorIntensity(value: number, maxValue: number): number {
  if (value === 0 || maxValue === 0) return 0
  const ratio = value / maxValue
  if (ratio < 0.25) return 1
  if (ratio < 0.5) return 2
  if (ratio < 0.75) return 3
  return 4
}

/**
 * Get heatmap color based on intensity level
 */
export function getHeatmapColor(
  intensity: number,
  accentColor: string,
  backgroundColor: string
): string {
  const isLightBg = backgroundColor.toLowerCase() === '#ffffff' || backgroundColor.toLowerCase() === '#fff'

  if (intensity === 0) {
    return isLightBg ? '#f0f0f0' : '#2a2a2a'
  }

  // Opacity-based shades for visual hierarchy
  const opacities = ['40', '70', 'A0', 'FF']
  return `${accentColor}${opacities[intensity - 1]}`
}

/**
 * Generate calendar cells for a month
 */
export function generateMonthCells(
  year: number,
  month: number,
  dateValueMap: Map<string, number>,
  maxValue: number
): CalendarCell[] {
  const cells: CalendarCell[] = []
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const value = dateValueMap.get(dateStr) || 0
    const dayOfWeek = (firstDay + day - 1) % 7
    const weekOfMonth = Math.floor((firstDay + day - 1) / 7)

    cells.push({
      date: dateStr,
      dayOfMonth: day,
      dayOfWeek,
      weekOfMonth,
      value,
      intensity: getColorIntensity(value, maxValue),
      hasActivity: value > 0
    })
  }

  return cells
}

/**
 * Generate full year calendar data
 */
export function generateYearCalendar(
  year: number,
  activities: StravaActivity[],
  colorBy: ColorByMetric = 'distance'
): MonthCalendar[] {
  const dateValueMap = aggregateActivitiesByDate(activities, colorBy)
  const maxValue = Math.max(...Array.from(dateValueMap.values()), 1)

  return Array.from({ length: 12 }, (_, month) => {
    const cells = generateMonthCells(year, month, dateValueMap, maxValue)
    const monthActivities = activities.filter(a => {
      const date = new Date(a.start_date_local || a.start_date)
      return date.getMonth() === month && date.getFullYear() === year
    })

    return {
      year,
      month,
      monthName: MONTH_NAMES_FULL[month],
      monthNameShort: MONTH_NAMES_SHORT[month],
      cells,
      totalActivities: monthActivities.length,
      totalValue: cells.reduce((sum, c) => sum + c.value, 0)
    }
  })
}

/**
 * Calculate calendar grid dimensions
 */
export function getCalendarGridDimensions(
  cellSize: number,
  cellGap: number
): { width: number; height: number; maxWeeks: number } {
  const columns = 7 // days of week
  const maxWeeks = 6 // max weeks a month can span

  return {
    width: columns * (cellSize + cellGap) - cellGap,
    height: maxWeeks * (cellSize + cellGap) - cellGap,
    maxWeeks
  }
}
