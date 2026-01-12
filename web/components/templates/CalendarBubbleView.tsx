/**
 * CalendarBubbleView - Bubble-sized activity calendar (Strava training log style)
 * Shows Q1 with sized bubbles based on distance
 */

import { Page, View, Text, Document } from '@react-pdf/renderer'
import { BookFormat, BookTheme, DEFAULT_THEME, FORMATS } from '@/lib/book-types'
import { SportLegend, DayActivity, SportType, getSportCategory } from '@/lib/calendar-views'
import { getDaysInMonth, getFirstDayOfMonth, MONTH_NAMES_FULL } from '@/lib/heatmap-utils'

// Simplified color palette for better brand cohesion (2-color scheme)
const BUBBLE_COLORS: Record<string, string> = {
  Run: '#FC4C02',           // Strava orange for cardio
  Ride: '#FC4C02',
  Swim: '#FC4C02',
  Hike: '#FC4C02',
  WeightTraining: '#333333', // Dark gray for strength
  Yoga: '#333333',
  Other: '#666666',
}

function getBubbleColor(sportType: string, accentColor: string): string {
  const category = getSportCategory(sportType)
  return BUBBLE_COLORS[category] || accentColor
}

interface CalendarBubbleViewProps {
  activity?: {
    year?: number
    activities?: DayActivity[]
  }
  format?: BookFormat
  theme?: BookTheme
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const CalendarBubbleView = ({
  activity,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: CalendarBubbleViewProps) => {
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

  // Only show first 3 months (Q1)
  const monthsToShow = [0, 1, 2]

  // Calculate Q1 stats
  const q1Activities = monthsToShow.flatMap(m => activitiesByMonth.get(m) || [])
  const q1Distance = q1Activities.reduce((sum, a) => sum + a.distance, 0) / 1000
  const q1Time = q1Activities.reduce((sum, a) => sum + a.duration, 0) / 3600

  // Find max distance for bubble scaling
  const maxDistance = Math.max(...q1Activities.map(a => a.distance), 1)

  const cellWidth = 80 * format.scaleFactor
  const cellHeight = 52 * format.scaleFactor
  const maxBubbleSize = 44 * format.scaleFactor
  const minBubbleSize = 18 * format.scaleFactor

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
          marginBottom: 14 * format.scaleFactor,
          borderBottomWidth: 3,
          borderBottomColor: theme.accentColor,
          paddingBottom: 10 * format.scaleFactor,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{
                fontSize: Math.max(14, 16 * format.scaleFactor),
                fontFamily: theme.fontPairing.body,
                color: theme.primaryColor,
                opacity: 0.6,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}>
                Training Log
              </Text>
              <Text style={{
                fontSize: Math.max(42, 56 * format.scaleFactor),
                fontFamily: theme.fontPairing.heading,
                color: theme.accentColor,
                fontWeight: 'bold',
                letterSpacing: -2,
              }}>
                Q1 {year}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 20 * format.scaleFactor }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: Math.max(28, 36 * format.scaleFactor),
                  fontFamily: theme.fontPairing.heading,
                  color: theme.primaryColor,
                  fontWeight: 'bold',
                }}>
                  {Math.round(q1Distance)}
                </Text>
                <Text style={{
                  fontSize: Math.max(10, 12 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.6,
                  textTransform: 'uppercase',
                }}>
                  km
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: Math.max(28, 36 * format.scaleFactor),
                  fontFamily: theme.fontPairing.heading,
                  color: theme.primaryColor,
                  fontWeight: 'bold',
                }}>
                  {Math.round(q1Time)}
                </Text>
                <Text style={{
                  fontSize: Math.max(10, 12 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.6,
                  textTransform: 'uppercase',
                }}>
                  hours
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: Math.max(28, 36 * format.scaleFactor),
                  fontFamily: theme.fontPairing.heading,
                  color: theme.primaryColor,
                  fontWeight: 'bold',
                }}>
                  {q1Activities.length}
                </Text>
                <Text style={{
                  fontSize: Math.max(10, 12 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.6,
                  textTransform: 'uppercase',
                }}>
                  activities
                </Text>
              </View>
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

            // Calculate month distance
            const monthDistance = monthActivities.reduce((sum, a) => sum + a.distance, 0) / 1000

            return (
              <View key={monthIndex} style={{
                marginBottom: idx < 2 ? 10 * format.scaleFactor : 0,
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
                    {Math.round(monthDistance)} km • {monthActivities.length} activities
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
                        <View key={item.key} style={{ width: '14.28%', height: cellHeight, justifyContent: 'center', alignItems: 'center' }} />
                      )
                    }

                    const { day, activity: dayActivity } = item

                    if (dayActivity) {
                      // Calculate bubble size based on distance
                      const distanceRatio = Math.sqrt(dayActivity.distance / maxDistance)
                      const bubbleSize = minBubbleSize + (maxBubbleSize - minBubbleSize) * Math.min(distanceRatio, 1)
                      const sportColor = getBubbleColor(dayActivity.sportType, theme.accentColor)
                      const distanceKm = dayActivity.distance / 1000

                      return (
                        <View key={item.key} style={{ width: '14.28%', height: cellHeight, justifyContent: 'center', alignItems: 'center' }}>
                          <View style={{
                            width: bubbleSize,
                            height: bubbleSize,
                            borderRadius: bubbleSize / 2,
                            backgroundColor: sportColor,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}>
                            {bubbleSize > 22 * format.scaleFactor && (
                              <Text style={{
                                fontSize: Math.max(10, Math.min(12, bubbleSize / 3.5)),
                                fontFamily: theme.fontPairing.body,
                                color: '#ffffff',
                                fontWeight: 'bold',
                              }}>
                                {distanceKm >= 10 ? Math.round(distanceKm) : distanceKm.toFixed(1)}
                              </Text>
                            )}
                          </View>
                        </View>
                      )
                    }

                    // Rest day
                    return (
                      <View key={item.key} style={{ width: '14.28%', height: cellHeight, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{
                          fontSize: Math.max(12, 14 * format.scaleFactor),
                          fontFamily: theme.fontPairing.body,
                          color: theme.primaryColor,
                          opacity: 0.5,
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <SportLegend sports={uniqueSports.slice(0, 5)} format={format} theme={theme} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * format.scaleFactor }}>
              <Text style={{
                fontSize: Math.max(9, 10 * format.scaleFactor),
                fontFamily: theme.fontPairing.body,
                color: theme.primaryColor,
                opacity: 0.6,
              }}>
                Bubble size = distance
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
