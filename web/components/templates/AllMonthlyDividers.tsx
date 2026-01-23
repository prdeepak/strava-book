/**
 * AllMonthlyDividers - Test component that renders MonthlyDividers for all months
 *
 * This component is used for iterative testing of MonthlyDivider templates.
 * It generates one page per month that has activities, allowing the visual
 * judge to score each month independently.
 */

import { Document } from '@react-pdf/renderer'
import { MonthlyDivider } from './MonthlyDivider'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { StravaActivity } from '@/lib/strava'

interface AllMonthlyDividersProps {
  activities: StravaActivity[]
  format?: BookFormat
  theme?: BookTheme
  units?: 'metric' | 'imperial'
}

interface MonthGroup {
  month: number  // 0-11
  year: number
  activities: StravaActivity[]
}

/**
 * Groups activities by year-month and returns sorted array
 */
function groupActivitiesByMonth(activities: StravaActivity[]): MonthGroup[] {
  const byMonth = new Map<string, MonthGroup>()

  for (const activity of activities) {
    const date = new Date(activity.start_date_local || activity.start_date)
    const month = date.getMonth()
    const year = date.getFullYear()
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (!byMonth.has(key)) {
      byMonth.set(key, { month, year, activities: [] })
    }
    byMonth.get(key)!.activities.push(activity)
  }

  // Sort chronologically
  return Array.from(byMonth.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
}

export const AllMonthlyDividers = ({
  activities,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  units = 'metric'
}: AllMonthlyDividersProps) => {
  const monthGroups = groupActivitiesByMonth(activities)

  return (
    <Document>
      {monthGroups.map((group) => (
        <MonthlyDivider
          key={`${group.year}-${group.month}`}
          activities={group.activities}
          format={format}
          theme={theme}
          units={units}
        />
      ))}
    </Document>
  )
}

export default AllMonthlyDividers
