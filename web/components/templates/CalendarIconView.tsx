/**
 * CalendarIconView - Sport icons calendar (Strava streaks style)
 * Shows Q1 (3 months) with large, prominent sport icons
 */

import { Page, View, Text, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { SportIcon, SportLegend, DayActivity, SportType, SPORT_COLORS, getSportCategory } from '@/lib/calendar-views'
import { getDaysInMonth, getFirstDayOfMonth, MONTH_NAMES_FULL } from '@/lib/heatmap-utils'

interface CalendarIconViewProps {
  activity?: {
    year?: number
    activities?: DayActivity[]
  }
  format?: BookFormat
  theme?: BookTheme
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CalendarIconView = ({
  activity,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: CalendarIconViewProps) => {
  const year = activity?.year || 2024
  const allActivities = activity?.activities || []

  // Group activities by month
  const activitiesByMonth = new Map<number, DayActivity[]>()
  allActivities.forEach(a => {
    const date = new Date(a.date)
    if (date.getFullYear() === year) {
      const month = date.getMonth()
      const existing = activitiesByMonth.get(month) || []
      existing.push(a)
      activitiesByMonth.set(month, existing)
    }
  })

  // Get unique sports for legend
  const uniqueSports = [...new Set(allActivities.map(a => a.sportType))] as SportType[]

  // Only show first 3 months (Q1) for better readability
  const monthsToShow = [0, 1, 2]

  // Calculate stats
  const q1Activities = monthsToShow.reduce((sum, m) => sum + (activitiesByMonth.get(m)?.length || 0), 0)

  const cellSize = 28 * format.scaleFactor
  const iconSize = 20 * format.scaleFactor

  return (
    <Document>
      <Page
        size={{ width: format.dimensions.width, height: format.dimensions.height }}
        style={{
          width: format.dimensions.width,
          height: format.dimensions.height,
          padding: format.safeMargin,
          backgroundColor: theme.backgroundColor,
        }}
      >
        {/* Header */}
        <View style={{
          marginBottom: 16 * format.scaleFactor,
          borderBottomWidth: 3,
          borderBottomColor: theme.accentColor,
          paddingBottom: 12 * format.scaleFactor,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{
              fontSize: Math.max(48, 64 * format.scaleFactor),
              fontFamily: theme.fontPairing.heading,
              color: theme.accentColor,
              fontWeight: 'bold',
              letterSpacing: -2,
            }}>
              Q1 {year}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{
                fontSize: Math.max(24, 32 * format.scaleFactor),
                fontFamily: theme.fontPairing.heading,
                color: theme.primaryColor,
                fontWeight: 'bold',
              }}>
                {q1Activities}
              </Text>
              <Text style={{
                fontSize: Math.max(10, 12 * format.scaleFactor),
                fontFamily: theme.fontPairing.body,
                color: theme.primaryColor,
                opacity: 0.6,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}>
                Activities
              </Text>
            </View>
          </View>
        </View>

        {/* Months */}
        <View style={{ flex: 1 }}>
          {monthsToShow.map((monthIndex, idx) => {
            const monthActivities = activitiesByMonth.get(monthIndex) || []
            const daysInMonth = getDaysInMonth(year, monthIndex)
            const firstDay = getFirstDayOfMonth(year, monthIndex)
            const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1

            const activityByDate = new Map<string, DayActivity>()
            monthActivities.forEach(a => activityByDate.set(a.date, a))

            const paddingDays = Array.from({ length: adjustedFirstDay }, (_, i) => ({ key: `pad-${i}`, empty: true as const }))
            const days = Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              return { key: dateStr, day, activity: activityByDate.get(dateStr) }
            })
            const allDays = [...paddingDays, ...days]

            return (
              <View key={monthIndex} style={{
                marginBottom: idx < 2 ? 12 * format.scaleFactor : 0,
                backgroundColor: '#fafafa',
                borderRadius: 8,
                padding: 10 * format.scaleFactor,
              }}>
                {/* Month Header */}
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8 * format.scaleFactor,
                  paddingBottom: 6 * format.scaleFactor,
                  borderBottomWidth: 2,
                  borderBottomColor: theme.accentColor,
                }}>
                  <Text style={{
                    fontSize: Math.max(16, 20 * format.scaleFactor),
                    fontFamily: theme.fontPairing.heading,
                    color: theme.primaryColor,
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                  }}>
                    {MONTH_NAMES_FULL[monthIndex]}
                  </Text>
                  <Text style={{
                    fontSize: Math.max(12, 14 * format.scaleFactor),
                    fontFamily: theme.fontPairing.body,
                    color: theme.accentColor,
                    fontWeight: 'bold',
                  }}>
                    {monthActivities.length} activities
                  </Text>
                </View>

                {/* Weekday Headers */}
                <View style={{ flexDirection: 'row', marginBottom: 4 * format.scaleFactor }}>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{
                        fontSize: Math.max(9, 10 * format.scaleFactor),
                        fontFamily: theme.fontPairing.body,
                        color: theme.primaryColor,
                        opacity: 0.5,
                        textTransform: 'uppercase',
                      }}>
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {allDays.map((item) => {
                    if ('empty' in item) {
                      return (
                        <View key={item.key} style={{ width: '14.28%', height: cellSize + 4, justifyContent: 'center', alignItems: 'center' }} />
                      )
                    }

                    const { day, activity: dayActivity } = item

                    if (dayActivity) {
                      const sportColor = SPORT_COLORS[getSportCategory(dayActivity.sportType)] || theme.accentColor
                      return (
                        <View key={item.key} style={{ width: '14.28%', height: cellSize + 4, justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: cellSize / 2,
                            backgroundColor: sportColor,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            <SportIcon sport={dayActivity.sportType} size={iconSize} color="#ffffff" />
                          </View>
                        </View>
                      )
                    }

                    // Rest day
                    return (
                      <View key={item.key} style={{ width: '14.28%', height: cellSize + 4, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{
                          fontSize: Math.max(11, 12 * format.scaleFactor),
                          fontFamily: theme.fontPairing.body,
                          color: theme.primaryColor,
                          opacity: 0.4,
                        }}>
                          {day}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            )
          })}
        </View>

        {/* Legend */}
        <View style={{
          marginTop: 8 * format.scaleFactor,
          paddingTop: 10 * format.scaleFactor,
          borderTopWidth: 2,
          borderTopColor: theme.primaryColor,
        }}>
          <SportLegend sports={uniqueSports.slice(0, 6)} format={format} theme={theme} />
        </View>
      </Page>
    </Document>
  )
}
