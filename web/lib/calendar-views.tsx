/**
 * Calendar visualization components for PDF rendering
 *
 * Three styles:
 * 1. IconCalendarMonth - Sport icons for activity days (like Strava streaks)
 * 2. HeatmapCalendarMonth - GitHub-style colored squares
 * 3. BubbleCalendarMonth - Sized bubbles with distance labels (like Strava training log)
 */

import { View, Text, Svg, Path, Circle, Rect, G } from '@react-pdf/renderer'
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from './book-types'
import { StravaActivity } from './strava'
import {
  CalendarCell,
  MonthCalendar,
  MONTH_NAMES_SHORT,
  WEEKDAY_LABELS,
  getDaysInMonth,
  getFirstDayOfMonth,
  getColorIntensity,
  getHeatmapColor,
} from './heatmap-utils'

// ============================================================================
// SPORT ICONS (SVG paths for react-pdf)
// ============================================================================

export type SportType =
  | 'Run' | 'TrailRun' | 'VirtualRun'
  | 'Ride' | 'MountainBikeRide' | 'GravelRide' | 'VirtualRide'
  | 'Swim' | 'OpenWaterSwim'
  | 'Walk' | 'Hike'
  | 'WeightTraining' | 'Workout' | 'CrossFit'
  | 'Yoga' | 'Pilates'
  | 'Rowing' | 'Kayaking'
  | 'NordicSki' | 'AlpineSki' | 'Snowboard'
  | 'Other'

// Map Strava sport types to our icon categories
export function getSportCategory(sportType: string): SportType {
  const type = sportType || 'Other'

  // Running
  if (['Run', 'TrailRun', 'VirtualRun', 'Treadmill'].includes(type)) return 'Run'

  // Cycling
  if (['Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide', 'EBikeRide', 'Velomobile'].includes(type)) return 'Ride'

  // Swimming
  if (['Swim', 'OpenWaterSwim'].includes(type)) return 'Swim'

  // Walking/Hiking
  if (['Walk', 'Hike'].includes(type)) return 'Hike'

  // Strength
  if (['WeightTraining', 'Workout', 'CrossFit', 'Crossfit'].includes(type)) return 'WeightTraining'

  // Yoga/Pilates
  if (['Yoga', 'Pilates'].includes(type)) return 'Yoga'

  // Water sports
  if (['Rowing', 'Kayaking', 'Canoeing', 'StandUpPaddling'].includes(type)) return 'Rowing'

  // Winter sports
  if (['NordicSki', 'BackcountrySki', 'AlpineSki', 'Snowboard', 'IceSkate'].includes(type)) return 'NordicSki'

  return 'Other'
}

// Sport icon colors (Strava-inspired)
export const SPORT_COLORS: Record<SportType, string> = {
  Run: '#FC4C02',           // Strava orange
  TrailRun: '#FC4C02',
  VirtualRun: '#FC4C02',
  Ride: '#0D6EFD',          // Blue
  MountainBikeRide: '#0D6EFD',
  GravelRide: '#0D6EFD',
  VirtualRide: '#0D6EFD',
  Swim: '#17A2B8',          // Cyan
  OpenWaterSwim: '#17A2B8',
  Walk: '#6F42C1',          // Purple
  Hike: '#795548',          // Brown
  WeightTraining: '#DC3545', // Red
  Workout: '#DC3545',
  CrossFit: '#DC3545',
  Yoga: '#9C27B0',          // Deep purple
  Pilates: '#9C27B0',
  Rowing: '#20C997',        // Teal
  Kayaking: '#20C997',
  NordicSki: '#6C757D',     // Gray
  AlpineSki: '#6C757D',
  Snowboard: '#6C757D',
  Other: '#6C757D',
}

interface SportIconProps {
  sport: SportType | string
  size: number
  color?: string
}

/**
 * Sport icon component - renders appropriate SVG for each sport
 * Icons are simplified for PDF rendering clarity
 */
export const SportIcon = ({ sport, size, color }: SportIconProps) => {
  const category = getSportCategory(sport)
  const iconColor = color || SPORT_COLORS[category] || '#6C757D'
  const strokeWidth = Math.max(1.5, size / 10)

  // All icons designed for 24x24 viewBox, scaled to size
  const scale = size / 24

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {category === 'Run' && (
        // Running person silhouette
        <G>
          <Circle cx="12" cy="4" r="2.5" fill={iconColor} />
          <Path
            d="M7 22l3-7 2.5 2.5V22h2v-6l-2.5-2.5 1-3c1.5 2 3.5 3 6 3v-2c-2 0-3.5-1-4.5-2.5l-1.5-2c-.5-.5-1-1-2-1s-1.5.5-2 1L6 11v4h2v-3l2-2-3 9"
            fill={iconColor}
          />
        </G>
      )}

      {category === 'Ride' && (
        // Bicycle
        <G>
          <Circle cx="6" cy="15" r="4" fill="none" stroke={iconColor} strokeWidth={strokeWidth} />
          <Circle cx="18" cy="15" r="4" fill="none" stroke={iconColor} strokeWidth={strokeWidth} />
          <Path
            d="M6 15l4-8h4l2 4h2M10 7l2 8M14 11l4 4"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      )}

      {category === 'Swim' && (
        // Swimming wave pattern
        <G>
          <Path
            d="M2 12c1-1 2-2 4-2s3 1 4 2 2 2 4 2 3-1 4-2 2-2 4-2"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Path
            d="M2 17c1-1 2-2 4-2s3 1 4 2 2 2 4 2 3-1 4-2 2-2 4-2"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Circle cx="9" cy="7" r="2" fill={iconColor} />
          <Path d="M11 9l3 2-1 3" fill="none" stroke={iconColor} strokeWidth={strokeWidth} />
        </G>
      )}

      {category === 'Hike' && (
        // Hiking boot
        <G>
          <Path
            d="M4 20h16v-2H8l-1-3-2 1v4zM8 15l2-6 3-1v-2l4 2v5l-3 2"
            fill={iconColor}
          />
          <Circle cx="14" cy="4" r="2" fill={iconColor} />
        </G>
      )}

      {category === 'WeightTraining' && (
        // Dumbbell
        <G>
          <Rect x="2" y="9" width="4" height="6" rx="1" fill={iconColor} />
          <Rect x="18" y="9" width="4" height="6" rx="1" fill={iconColor} />
          <Rect x="5" y="7" width="2" height="10" rx="0.5" fill={iconColor} />
          <Rect x="17" y="7" width="2" height="10" rx="0.5" fill={iconColor} />
          <Rect x="7" y="11" width="10" height="2" fill={iconColor} />
        </G>
      )}

      {category === 'Yoga' && (
        // Person in yoga pose
        <G>
          <Circle cx="12" cy="4" r="2.5" fill={iconColor} />
          <Path
            d="M12 8v6M12 14l-4 6M12 14l4 6M8 12h8"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </G>
      )}

      {category === 'Rowing' && (
        // Rowing oar
        <G>
          <Path
            d="M4 12l16-8M4 12c0 2 2 4 4 4l12-8M4 12l4 4"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M18 6l2-2 2 2-2 2z" fill={iconColor} />
        </G>
      )}

      {category === 'NordicSki' && (
        // Ski poles
        <G>
          <Path
            d="M6 4l2 16M16 4l2 16M4 18h6M14 18h6"
            fill="none"
            stroke={iconColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Circle cx="8" cy="4" r="1.5" fill={iconColor} />
          <Circle cx="18" cy="4" r="1.5" fill={iconColor} />
        </G>
      )}

      {/* Default: simple activity dot */}
      {category === 'Other' && (
        <Circle cx="12" cy="12" r="6" fill={iconColor} />
      )}
    </Svg>
  )
}

// ============================================================================
// ACTIVITY DATA TYPES
// ============================================================================

export interface DayActivity {
  date: string              // YYYY-MM-DD
  sportType: SportType | string
  distance: number          // meters
  duration: number          // seconds
  name?: string
  intensity?: number        // 0-4
}

export interface MonthData {
  year: number
  month: number             // 0-11
  activities: DayActivity[]
}

// ============================================================================
// COMMON PROPS
// ============================================================================

interface CalendarMonthProps {
  year: number
  month: number              // 0-11
  activities: DayActivity[]
  format?: BookFormat
  theme?: BookTheme
  cellSize?: number
  showMonthLabel?: boolean
  showWeekdayLabels?: boolean
}

// ============================================================================
// 1. ICON CALENDAR MONTH (Strava Streaks Style)
// ============================================================================

interface IconCalendarMonthProps extends CalendarMonthProps {
  showDayNumbers?: boolean   // Show day number for non-activity days
}

/**
 * Icon-based calendar month - shows sport icons for activity days
 * Similar to Strava's streak calendar view
 */
export const IconCalendarMonth = ({
  year,
  month,
  activities,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  cellSize: propCellSize,
  showMonthLabel = true,
  showWeekdayLabels = true,
  showDayNumbers = true,
}: IconCalendarMonthProps) => {
  const cellSize = propCellSize || 14 * format.scaleFactor
  const cellGap = 2 * format.scaleFactor
  const iconSize = cellSize * 0.7

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Create activity lookup by date
  const activityByDate = new Map<string, DayActivity>()
  activities.forEach(a => activityByDate.set(a.date, a))

  // Generate day cells
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = (firstDay + i) % 7
    const weekRow = Math.floor((firstDay + i) / 7)
    const activity = activityByDate.get(dateStr)

    return { day, dateStr, dayOfWeek, weekRow, activity }
  })

  const gridWidth = 7 * (cellSize + cellGap)
  const gridHeight = 6 * (cellSize + cellGap)

  return (
    <View style={{ width: gridWidth }}>
      {/* Month label */}
      {showMonthLabel && (
        <Text style={{
          fontSize: Math.max(11, 13 * format.scaleFactor),
          fontFamily: theme.fontPairing.heading,
          color: theme.primaryColor,
          marginBottom: 4 * format.scaleFactor,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontWeight: 'bold',
        }}>
          {MONTH_NAMES_SHORT[month]}
        </Text>
      )}

      {/* Weekday labels */}
      {showWeekdayLabels && (
        <View style={{
          flexDirection: 'row',
          marginBottom: 2 * format.scaleFactor,
        }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={{
              width: cellSize + cellGap,
              fontSize: Math.max(8, 9 * format.scaleFactor),
              fontFamily: theme.fontPairing.body,
              color: theme.primaryColor,
              opacity: 0.5,
              textAlign: 'center',
            }}>
              {label}
            </Text>
          ))}
        </View>
      )}

      {/* Calendar grid using SVG for precise positioning */}
      <Svg width={gridWidth} height={gridHeight} viewBox={`0 0 ${gridWidth} ${gridHeight}`}>
        {days.map(({ day, dayOfWeek, weekRow, activity }) => {
          const x = dayOfWeek * (cellSize + cellGap)
          const y = weekRow * (cellSize + cellGap)
          const centerX = x + cellSize / 2
          const centerY = y + cellSize / 2

          if (activity) {
            // Activity day - show icon in circle
            const sportColor = SPORT_COLORS[getSportCategory(activity.sportType)] || theme.accentColor
            return (
              <G key={day}>
                {/* Background circle */}
                <Circle
                  cx={centerX}
                  cy={centerY}
                  r={cellSize / 2 - 1}
                  fill="#ffffff"
                  stroke={sportColor}
                  strokeWidth={1.5}
                />
                {/* Sport icon will be rendered separately due to react-pdf limitations */}
              </G>
            )
          } else if (showDayNumbers) {
            // Rest day - show day number in empty circle
            return (
              <G key={day}>
                <Circle
                  cx={centerX}
                  cy={centerY}
                  r={cellSize / 2 - 1}
                  fill="none"
                  stroke={theme.primaryColor}
                  strokeWidth={0.5}
                  opacity={0.3}
                />
              </G>
            )
          }
          return null
        })}
      </Svg>

      {/* Overlay View layer for icons and text (react-pdf SVG text limitations) */}
      <View style={{
        position: 'absolute',
        top: showMonthLabel ? (12 + 4) * format.scaleFactor : 0,
        left: 0,
        width: gridWidth,
        height: gridHeight,
      }}>
        {days.map(({ day, dayOfWeek, weekRow, activity }) => {
          const x = dayOfWeek * (cellSize + cellGap)
          const y = weekRow * (cellSize + cellGap) + (showWeekdayLabels ? 10 * format.scaleFactor : 0)

          if (activity) {
            return (
              <View key={day} style={{
                position: 'absolute',
                left: x + (cellSize - iconSize) / 2,
                top: y + (cellSize - iconSize) / 2,
              }}>
                <SportIcon
                  sport={activity.sportType}
                  size={iconSize}
                />
              </View>
            )
          } else if (showDayNumbers) {
            return (
              <View key={day} style={{
                position: 'absolute',
                left: x,
                top: y,
                width: cellSize,
                height: cellSize,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: Math.max(8, 10 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.5,
                }}>
                  {day}
                </Text>
              </View>
            )
          }
          return null
        })}
      </View>
    </View>
  )
}

// ============================================================================
// 2. HEATMAP CALENDAR MONTH (GitHub Style)
// ============================================================================

interface HeatmapCalendarMonthProps extends CalendarMonthProps {
  colorBy?: 'distance' | 'time' | 'count'
  maxValue?: number         // For consistent scaling across months
}

/**
 * Heatmap-style calendar month - colored squares based on activity intensity
 * Similar to GitHub contribution graph
 */
export const HeatmapCalendarMonth = ({
  year,
  month,
  activities,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  cellSize: propCellSize,
  showMonthLabel = true,
  showWeekdayLabels = false,
  colorBy = 'distance',
  maxValue: propMaxValue,
}: HeatmapCalendarMonthProps) => {
  const cellSize = propCellSize || 8 * format.scaleFactor
  const cellGap = 1.5 * format.scaleFactor
  const cornerRadius = 1.5

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Aggregate values by date
  const valueByDate = new Map<string, number>()
  activities.forEach(a => {
    const current = valueByDate.get(a.date) || 0
    let value = 0
    switch (colorBy) {
      case 'distance': value = a.distance / 1000; break  // km
      case 'time': value = a.duration / 3600; break      // hours
      case 'count': value = 1; break
    }
    valueByDate.set(a.date, current + value)
  })

  // Calculate max value for intensity scaling
  const values = Array.from(valueByDate.values())
  const maxValue = propMaxValue || Math.max(...values, 1)

  // Generate cells
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = (firstDay + i) % 7
    const weekRow = Math.floor((firstDay + i) / 7)
    const value = valueByDate.get(dateStr) || 0
    const intensity = getColorIntensity(value, maxValue)

    return { day, dateStr, dayOfWeek, weekRow, value, intensity }
  })

  const gridWidth = 7 * (cellSize + cellGap)
  const gridHeight = 6 * (cellSize + cellGap)

  return (
    <View style={{ alignItems: 'flex-start' }}>
      {/* Month label */}
      {showMonthLabel && (
        <Text style={{
          fontSize: Math.max(7, 8 * format.scaleFactor),
          fontFamily: theme.fontPairing.heading,
          color: theme.primaryColor,
          marginBottom: 3 * format.scaleFactor,
          letterSpacing: 1,
          textTransform: 'uppercase',
          fontWeight: 'bold',
        }}>
          {MONTH_NAMES_SHORT[month]}
        </Text>
      )}

      {/* Heatmap grid */}
      <Svg width={gridWidth} height={gridHeight} viewBox={`0 0 ${gridWidth} ${gridHeight}`}>
        {cells.map(({ day, dayOfWeek, weekRow, intensity }) => {
          const x = dayOfWeek * (cellSize + cellGap)
          const y = weekRow * (cellSize + cellGap)
          const color = getHeatmapColor(intensity, theme.accentColor, theme.backgroundColor)

          return (
            <Rect
              key={day}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              fill={color}
              rx={cornerRadius}
              ry={cornerRadius}
            />
          )
        })}
      </Svg>
    </View>
  )
}

// ============================================================================
// 3. BUBBLE CALENDAR MONTH (Strava Training Log Style)
// ============================================================================

interface BubbleCalendarMonthProps extends CalendarMonthProps {
  showActivityNames?: boolean
  showDistanceLabels?: boolean
  maxBubbleSize?: number
  minBubbleSize?: number
}

/**
 * Bubble-style calendar month - sized circles based on distance
 * Similar to Strava's training log view
 */
export const BubbleCalendarMonth = ({
  year,
  month,
  activities,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  cellSize: propCellSize,
  showMonthLabel = true,
  showWeekdayLabels = true,
  showActivityNames = false,
  showDistanceLabels = true,
  maxBubbleSize,
  minBubbleSize,
}: BubbleCalendarMonthProps) => {
  const cellSize = propCellSize || 20 * format.scaleFactor
  const cellGap = 4 * format.scaleFactor
  const maxBubble = maxBubbleSize || cellSize * 0.9
  const minBubble = minBubbleSize || cellSize * 0.3

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  // Group activities by date
  const activitiesByDate = new Map<string, DayActivity[]>()
  activities.forEach(a => {
    const existing = activitiesByDate.get(a.date) || []
    existing.push(a)
    activitiesByDate.set(a.date, existing)
  })

  // Find max distance for scaling
  const allDistances = activities.map(a => a.distance)
  const maxDistance = Math.max(...allDistances, 1000) // min 1km for scaling

  // Generate days
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = (firstDay + i) % 7
    const weekRow = Math.floor((firstDay + i) / 7)
    const dayActivities = activitiesByDate.get(dateStr) || []

    // Use primary activity (longest distance) for bubble
    const primaryActivity = dayActivities.length > 0
      ? dayActivities.reduce((a, b) => a.distance > b.distance ? a : b)
      : null

    return { day, dateStr, dayOfWeek, weekRow, primaryActivity, allActivities: dayActivities }
  })

  const gridWidth = 7 * (cellSize + cellGap)
  const gridHeight = 6 * (cellSize + cellGap + (showActivityNames ? 10 * format.scaleFactor : 0))

  return (
    <View style={{ width: gridWidth }}>
      {/* Month label */}
      {showMonthLabel && (
        <Text style={{
          fontSize: Math.max(9, 11 * format.scaleFactor),
          fontFamily: theme.fontPairing.heading,
          color: theme.primaryColor,
          marginBottom: 6 * format.scaleFactor,
          fontWeight: 'bold',
        }}>
          {MONTH_NAMES_SHORT[month]} {year}
        </Text>
      )}

      {/* Weekday labels */}
      {showWeekdayLabels && (
        <View style={{
          flexDirection: 'row',
          marginBottom: 4 * format.scaleFactor,
        }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <Text key={i} style={{
              width: cellSize + cellGap,
              fontSize: Math.max(6, 7 * format.scaleFactor),
              fontFamily: theme.fontPairing.body,
              color: theme.primaryColor,
              opacity: 0.5,
              textAlign: 'center',
            }}>
              {label}
            </Text>
          ))}
        </View>
      )}

      {/* Bubble grid */}
      <View style={{ position: 'relative', height: gridHeight }}>
        {days.map(({ day, dayOfWeek, weekRow, primaryActivity, allActivities }) => {
          const x = dayOfWeek * (cellSize + cellGap)
          const y = weekRow * (cellSize + cellGap + (showActivityNames ? 10 * format.scaleFactor : 0))

          if (!primaryActivity) {
            // Empty day - show faint day number
            return (
              <View key={day} style={{
                position: 'absolute',
                left: x,
                top: y,
                width: cellSize,
                height: cellSize,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={{
                  fontSize: Math.max(6, 7 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.2,
                }}>
                  {day}
                </Text>
              </View>
            )
          }

          // Calculate bubble size based on distance
          const distanceRatio = Math.sqrt(primaryActivity.distance / maxDistance) // sqrt for better visual scaling
          const bubbleSize = minBubble + (maxBubble - minBubble) * Math.min(distanceRatio, 1)
          const sportColor = SPORT_COLORS[getSportCategory(primaryActivity.sportType)] || theme.accentColor
          const distanceKm = primaryActivity.distance / 1000

          return (
            <View key={day} style={{
              position: 'absolute',
              left: x,
              top: y,
              width: cellSize,
              alignItems: 'center',
            }}>
              {/* Bubble */}
              <View style={{
                width: bubbleSize,
                height: bubbleSize,
                borderRadius: bubbleSize / 2,
                backgroundColor: sportColor,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {/* Distance label inside bubble */}
                {showDistanceLabels && bubbleSize > 14 * format.scaleFactor && (
                  <Text style={{
                    fontSize: Math.max(5, Math.min(6, bubbleSize / 3)),
                    fontFamily: theme.fontPairing.body,
                    color: '#ffffff',
                    fontWeight: 'bold',
                  }}>
                    {distanceKm >= 10 ? Math.round(distanceKm) : distanceKm.toFixed(1)}
                  </Text>
                )}
              </View>

              {/* Activity name below bubble */}
              {showActivityNames && primaryActivity.name && (
                <Text style={{
                  fontSize: Math.max(4, 5 * format.scaleFactor),
                  fontFamily: theme.fontPairing.body,
                  color: theme.primaryColor,
                  opacity: 0.6,
                  marginTop: 2,
                  textAlign: 'center',
                  maxWidth: cellSize + cellGap,
                  overflow: 'hidden',
                }}>
                  {primaryActivity.name.slice(0, 12)}
                </Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ============================================================================
// MULTI-MONTH VIEWS
// ============================================================================

interface YearCalendarGridProps {
  year: number
  activities: DayActivity[]
  style: 'icon' | 'heatmap' | 'bubble'
  format?: BookFormat
  theme?: BookTheme
  columns?: number
}

/**
 * Render a full year as a grid of months
 */
export const YearCalendarGrid = ({
  year,
  activities,
  style,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  columns = 4,
}: YearCalendarGridProps) => {
  // Group activities by month
  const activitiesByMonth = new Map<number, DayActivity[]>()
  activities.forEach(a => {
    const date = new Date(a.date)
    if (date.getFullYear() === year) {
      const month = date.getMonth()
      const existing = activitiesByMonth.get(month) || []
      existing.push(a)
      activitiesByMonth.set(month, existing)
    }
  })

  // Calculate max value for consistent heatmap scaling
  const allDistances = activities.map(a => a.distance / 1000)
  const maxDistance = Math.max(...allDistances, 1)

  const MonthComponent = style === 'icon' ? IconCalendarMonth
    : style === 'bubble' ? BubbleCalendarMonth
    : HeatmapCalendarMonth

  const months = Array.from({ length: 12 }, (_, i) => i)

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12 * format.scaleFactor,
    }}>
      {months.map(month => (
        <View key={month} style={{ width: `${100 / columns - 2}%` }}>
          <MonthComponent
            year={year}
            month={month}
            activities={activitiesByMonth.get(month) || []}
            format={format}
            theme={theme}
            {...(style === 'heatmap' ? { maxValue: maxDistance } : {})}
          />
        </View>
      ))}
    </View>
  )
}

// ============================================================================
// LEGEND COMPONENTS
// ============================================================================

interface HeatmapLegendProps {
  format?: BookFormat
  theme?: BookTheme
}

/**
 * Heatmap intensity legend (Less → More)
 */
export const HeatmapLegend = ({
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: HeatmapLegendProps) => {
  const boxSize = 12 * format.scaleFactor

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6 * format.scaleFactor,
    }}>
      <Text style={{
        fontSize: Math.max(7, 8 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: theme.primaryColor,
        opacity: 0.6,
      }}>
        Less
      </Text>

      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0, 1, 2, 3, 4].map(intensity => (
          <Svg key={intensity} width={boxSize} height={boxSize}>
            <Rect
              x={0}
              y={0}
              width={boxSize}
              height={boxSize}
              fill={getHeatmapColor(intensity, theme.accentColor, theme.backgroundColor)}
              rx={2}
              ry={2}
            />
          </Svg>
        ))}
      </View>

      <Text style={{
        fontSize: Math.max(7, 8 * format.scaleFactor),
        fontFamily: theme.fontPairing.body,
        color: theme.primaryColor,
        opacity: 0.6,
      }}>
        More
      </Text>
    </View>
  )
}

interface SportLegendProps {
  sports: SportType[]
  format?: BookFormat
  theme?: BookTheme
}

/**
 * Sport icon legend
 */
export const SportLegend = ({
  sports,
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
}: SportLegendProps) => {
  const iconSize = 18 * format.scaleFactor

  return (
    <View style={{
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14 * format.scaleFactor,
    }}>
      {sports.map(sport => (
        <View key={sport} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5 * format.scaleFactor,
        }}>
          <SportIcon sport={sport} size={iconSize} />
          <Text style={{
            fontSize: Math.max(10, 11 * format.scaleFactor),
            fontFamily: theme.fontPairing.body,
            color: theme.primaryColor,
            opacity: 0.8,
          }}>
            {sport}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ============================================================================
// HELPER: Convert StravaActivity to DayActivity
// ============================================================================

export function stravaActivityToDayActivity(activity: StravaActivity): DayActivity {
  const dateStr = activity.start_date_local
    ? new Date(activity.start_date_local).toISOString().split('T')[0]
    : new Date(activity.start_date).toISOString().split('T')[0]

  return {
    date: dateStr,
    sportType: activity.sport_type || activity.type || 'Other',
    distance: activity.distance || 0,
    duration: activity.moving_time || 0,
    name: activity.name,
  }
}

export function stravaActivitiesToDayActivities(activities: StravaActivity[]): DayActivity[] {
  return activities.map(stravaActivityToDayActivity)
}
