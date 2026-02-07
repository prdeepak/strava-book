/**
 * CSV Parser for Strava Export
 *
 * Parses activities.csv from Strava's bulk data export into StravaActivity[] format.
 *
 * Key challenges:
 * - Duplicate column names (e.g., "Elapsed Time" appears twice)
 * - Date format: "26 Aug 2023, 13:50:06" (not ISO 8601)
 * - No workout_type in CSV — must be inferred from existing cache or left unset
 * - No GPS coordinates in CSV — must come from FIT files
 */

import { promises as fs } from 'fs'
import { StravaActivity } from '../strava'

/**
 * Raw row from activities.csv (column indices, not names, since names duplicate)
 */
interface CsvRow {
  activityId: string            // col 0
  activityDate: string          // col 1
  activityName: string          // col 2
  activityType: string          // col 3
  activityDescription: string   // col 4
  elapsedTimeDisplay: string    // col 5 (display version)
  distanceDisplay: string       // col 6 (display version)
  maxHeartRateDisplay: string   // col 7
  relativeEffortDisplay: string // col 8
  commuteDisplay: string        // col 9
  activityPrivateNote: string   // col 10
  activityGear: string          // col 11
  filename: string              // col 12
  athleteWeight: string         // col 13
  bikeWeight: string            // col 14
  elapsedTime: string           // col 15 (detailed, in seconds)
  movingTime: string            // col 16
  distance: string              // col 17 (detailed, in meters)
  maxSpeed: string              // col 18
  averageSpeed: string          // col 19
  elevationGain: string         // col 20
  elevationLoss: string         // col 21
  elevationLow: string          // col 22
  elevationHigh: string         // col 23
  maxGrade: string              // col 24
  averageGrade: string          // col 25
  avgPosGrade: string           // col 26
  avgNegGrade: string           // col 27
  maxCadence: string            // col 28
  averageCadence: string        // col 29
  maxHeartRate: string          // col 30 (detailed)
  averageHeartRate: string      // col 31
  maxWatts: string              // col 32
  averageWatts: string          // col 33
  calories: string              // col 34
  maxTemp: string               // col 35
  avgTemp: string               // col 36
  relativeEffort: string        // col 37 (detailed)
  totalWork: string             // col 38
  numRuns: string               // col 39
  uphillTime: string            // col 40
  downhillTime: string          // col 41
  otherTime: string             // col 42
  perceivedExertion: string     // col 43
  type: string                  // col 44
  startTime: string             // col 45
  weightedAvgPower: string      // col 46
  powerCount: string            // col 47
  preferPerceivedExertion: string // col 48
  perceivedRelativeEffort: string // col 49
  commute: string               // col 50
  totalWeightLifted: string     // col 51
  fromUpload: string            // col 52
  gradeAdjustedDistance: string  // col 53
  weatherObsTime: string        // col 54
  weatherCondition: string      // col 55
  weatherTemp: string           // col 56
  apparentTemp: string          // col 57
  dewpoint: string              // col 58
  humidity: string              // col 59
  weatherPressure: string       // col 60
  windSpeed: string             // col 61
  windGust: string              // col 62
  windBearing: string           // col 63
  precipitationIntensity: string // col 64
  sunriseTime: string           // col 65
  sunsetTime: string            // col 66
  moonPhase: string             // col 67
  bike: string                  // col 68
  gear: string                  // col 69
  precipProbability: string     // col 70
  precipType: string            // col 71
  cloudCover: string            // col 72
  weatherVisibility: string     // col 73
  uvIndex: string               // col 74
  weatherOzone: string          // col 75
  jumpCount: string             // col 76
  totalGrit: string             // col 77
  averageFlow: string           // col 78
  flagged: string               // col 79
  averageElapsedSpeed: string   // col 80
  dirtDistance: string           // col 81
  newlyExploredDistance: string  // col 82
  newlyExploredDirtDistance: string // col 83
  activityCount: string         // col 84
  totalSteps: string            // col 85
  carbonSaved: string           // col 86
  poolLength: string            // col 87
  trainingLoad: string          // col 88
  intensity: string             // col 89
  avgGradeAdjustedPace: string  // col 90
  timerTime: string             // col 91
  totalCycles: string           // col 92
  recovery: string              // col 93
  withPet: string               // col 94
  competition: string           // col 95
  longRun: string               // col 96
  forACause: string             // col 97
  withKid: string               // col 98
  downhillDistance: string       // col 99
  media: string                 // col 100
}

/**
 * Parse a Strava export date string into ISO 8601
 * Input: "26 Aug 2023, 13:50:06"
 * Output: "2023-08-26T13:50:06Z"
 */
function parseStravaDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) return ''

  // "26 Aug 2023, 13:50:06"
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  }

  const match = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4}),\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return dateStr

  const [, day, monthStr, year, hour, min, sec] = match
  const month = months[monthStr]
  if (!month) return dateStr

  return `${year}-${month}-${day.padStart(2, '0')}T${hour}:${min}:${sec}Z`
}

/**
 * Map CSV activity type to Strava API type and sport_type
 */
function mapActivityType(csvType: string): { type: string; sport_type: string } {
  const mapping: Record<string, { type: string; sport_type: string }> = {
    'Run': { type: 'Run', sport_type: 'Run' },
    'Ride': { type: 'Ride', sport_type: 'Ride' },
    'Swim': { type: 'Swim', sport_type: 'Swim' },
    'Hike': { type: 'Hike', sport_type: 'Hike' },
    'Walk': { type: 'Walk', sport_type: 'Walk' },
    'Yoga': { type: 'Yoga', sport_type: 'Yoga' },
    'Workout': { type: 'Workout', sport_type: 'Workout' },
    'Weight Training': { type: 'WeightTraining', sport_type: 'WeightTraining' },
    'Nordic Ski': { type: 'NordicSki', sport_type: 'NordicSki' },
    'Kayaking': { type: 'Kayaking', sport_type: 'Kayaking' },
    'Canoe': { type: 'Canoeing', sport_type: 'Canoeing' },
  }

  return mapping[csvType] || { type: csvType, sport_type: csvType }
}

function parseFloat0(s: string): number {
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function parseIntOrNull(s: string): number | null {
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

/**
 * Simple CSV parser that handles quoted fields with commas and newlines
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current)
  return fields
}

/**
 * Parse activities.csv with multi-line field support
 */
function parseCSVContent(content: string): string[][] {
  const rows: string[][] = []
  let currentLine = ''
  let inQuotes = false

  const lines = content.split('\n')

  for (const line of lines) {
    if (currentLine === '') {
      currentLine = line
    } else {
      currentLine += '\n' + line
    }

    // Count unescaped quotes to determine if we're still in a quoted field
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      }
    }

    if (!inQuotes) {
      if (currentLine.trim()) {
        rows.push(parseCSVLine(currentLine))
      }
      currentLine = ''
    }
  }

  // Handle any remaining content
  if (currentLine.trim()) {
    rows.push(parseCSVLine(currentLine))
  }

  return rows
}

/**
 * Convert a raw CSV row array to a CsvRow object
 */
function rowToCsvRow(fields: string[]): CsvRow {
  return {
    activityId: fields[0] || '',
    activityDate: fields[1] || '',
    activityName: fields[2] || '',
    activityType: fields[3] || '',
    activityDescription: fields[4] || '',
    elapsedTimeDisplay: fields[5] || '',
    distanceDisplay: fields[6] || '',
    maxHeartRateDisplay: fields[7] || '',
    relativeEffortDisplay: fields[8] || '',
    commuteDisplay: fields[9] || '',
    activityPrivateNote: fields[10] || '',
    activityGear: fields[11] || '',
    filename: fields[12] || '',
    athleteWeight: fields[13] || '',
    bikeWeight: fields[14] || '',
    elapsedTime: fields[15] || '',
    movingTime: fields[16] || '',
    distance: fields[17] || '',
    maxSpeed: fields[18] || '',
    averageSpeed: fields[19] || '',
    elevationGain: fields[20] || '',
    elevationLoss: fields[21] || '',
    elevationLow: fields[22] || '',
    elevationHigh: fields[23] || '',
    maxGrade: fields[24] || '',
    averageGrade: fields[25] || '',
    avgPosGrade: fields[26] || '',
    avgNegGrade: fields[27] || '',
    maxCadence: fields[28] || '',
    averageCadence: fields[29] || '',
    maxHeartRate: fields[30] || '',
    averageHeartRate: fields[31] || '',
    maxWatts: fields[32] || '',
    averageWatts: fields[33] || '',
    calories: fields[34] || '',
    maxTemp: fields[35] || '',
    avgTemp: fields[36] || '',
    relativeEffort: fields[37] || '',
    totalWork: fields[38] || '',
    numRuns: fields[39] || '',
    uphillTime: fields[40] || '',
    downhillTime: fields[41] || '',
    otherTime: fields[42] || '',
    perceivedExertion: fields[43] || '',
    type: fields[44] || '',
    startTime: fields[45] || '',
    weightedAvgPower: fields[46] || '',
    powerCount: fields[47] || '',
    preferPerceivedExertion: fields[48] || '',
    perceivedRelativeEffort: fields[49] || '',
    commute: fields[50] || '',
    totalWeightLifted: fields[51] || '',
    fromUpload: fields[52] || '',
    gradeAdjustedDistance: fields[53] || '',
    weatherObsTime: fields[54] || '',
    weatherCondition: fields[55] || '',
    weatherTemp: fields[56] || '',
    apparentTemp: fields[57] || '',
    dewpoint: fields[58] || '',
    humidity: fields[59] || '',
    weatherPressure: fields[60] || '',
    windSpeed: fields[61] || '',
    windGust: fields[62] || '',
    windBearing: fields[63] || '',
    precipitationIntensity: fields[64] || '',
    sunriseTime: fields[65] || '',
    sunsetTime: fields[66] || '',
    moonPhase: fields[67] || '',
    bike: fields[68] || '',
    gear: fields[69] || '',
    precipProbability: fields[70] || '',
    precipType: fields[71] || '',
    cloudCover: fields[72] || '',
    weatherVisibility: fields[73] || '',
    uvIndex: fields[74] || '',
    weatherOzone: fields[75] || '',
    jumpCount: fields[76] || '',
    totalGrit: fields[77] || '',
    averageFlow: fields[78] || '',
    flagged: fields[79] || '',
    averageElapsedSpeed: fields[80] || '',
    dirtDistance: fields[81] || '',
    newlyExploredDistance: fields[82] || '',
    newlyExploredDirtDistance: fields[83] || '',
    activityCount: fields[84] || '',
    totalSteps: fields[85] || '',
    carbonSaved: fields[86] || '',
    poolLength: fields[87] || '',
    trainingLoad: fields[88] || '',
    intensity: fields[89] || '',
    avgGradeAdjustedPace: fields[90] || '',
    timerTime: fields[91] || '',
    totalCycles: fields[92] || '',
    recovery: fields[93] || '',
    withPet: fields[94] || '',
    competition: fields[95] || '',
    longRun: fields[96] || '',
    forACause: fields[97] || '',
    withKid: fields[98] || '',
    downhillDistance: fields[99] || '',
    media: fields[100] || '',
  }
}

/**
 * Convert a CsvRow to a StravaActivity
 */
function csvRowToActivity(row: CsvRow, athleteId: number): StravaActivity {
  const { type, sport_type } = mapActivityType(row.activityType)
  const startDate = parseStravaDate(row.activityDate)

  const maxHr = parseIntOrNull(row.maxHeartRate)
  const avgHr = parseFloat0(row.averageHeartRate)
  const hasHeartrate = maxHr !== null && maxHr > 0

  const gearId = row.gear ? `g${row.gear.replace(/\.0$/, '')}` : null

  const activity: StravaActivity = {
    id: parseInt(row.activityId, 10),
    athlete: {
      id: athleteId,
      resource_state: 1,
    },
    name: row.activityName,
    distance: parseFloat0(row.distance),
    moving_time: Math.round(parseFloat0(row.movingTime)),
    elapsed_time: Math.round(parseFloat0(row.elapsedTime)),
    total_elevation_gain: parseFloat0(row.elevationGain),
    type,
    sport_type,
    start_date: startDate,
    start_date_local: startDate, // CSV date is likely local time; we'll refine later
    timezone: '',
    description: row.activityDescription || undefined,
    kudos_count: 0,
    map: {
      summary_polyline: '', // Will be filled from FIT file
    },
    suffer_score: parseFloat0(row.relativeEffort) || undefined,
  }

  // Optional fields
  if (hasHeartrate) {
    (activity as Record<string, unknown>).has_heartrate = true
    ;(activity as Record<string, unknown>).average_heartrate = avgHr
    ;(activity as Record<string, unknown>).max_heartrate = maxHr
  }

  if (row.averageSpeed) {
    (activity as Record<string, unknown>).average_speed = parseFloat0(row.averageSpeed)
  }
  if (row.maxSpeed) {
    (activity as Record<string, unknown>).max_speed = parseFloat0(row.maxSpeed)
  }
  if (row.elevationHigh) {
    (activity as Record<string, unknown>).elev_high = parseFloat0(row.elevationHigh)
  }
  if (row.elevationLow) {
    (activity as Record<string, unknown>).elev_low = parseFloat0(row.elevationLow)
  }
  if (row.calories) {
    (activity as Record<string, unknown>).calories = parseFloat0(row.calories)
  }
  if (row.perceivedExertion) {
    (activity as Record<string, unknown>).perceived_exertion = parseFloat0(row.perceivedExertion)
  }
  if (gearId) {
    (activity as Record<string, unknown>).gear_id = gearId
  }
  if (row.commute === '1.0' || row.commute === '1' || row.commuteDisplay === 'true') {
    (activity as Record<string, unknown>).commute = true
  }
  if (row.activityPrivateNote) {
    (activity as Record<string, unknown>).private_note = row.activityPrivateNote
  }
  if (row.totalSteps) {
    (activity as Record<string, unknown>).total_steps = parseFloat0(row.totalSteps)
  }

  return activity
}

/**
 * Parse the activities.csv file and return StravaActivity[]
 */
export async function parseActivitiesCSV(
  csvPath: string,
  athleteId: number
): Promise<StravaActivity[]> {
  const content = await fs.readFile(csvPath, 'utf-8')
  const rows = parseCSVContent(content)

  // Skip header row
  const dataRows = rows.slice(1)

  const activities: StravaActivity[] = []
  for (const fields of dataRows) {
    if (!fields[0] || !fields[0].trim()) continue // Skip empty rows

    const csvRow = rowToCsvRow(fields)
    const activity = csvRowToActivity(csvRow, athleteId)
    activities.push(activity)
  }

  return activities
}

/**
 * Extract media references from a CSV row's Media column
 * Format: "media/UUID.jpg|media/UUID2.jpg|..."
 */
export function extractMediaReferences(mediaField: string): string[] {
  if (!mediaField || !mediaField.trim()) return []
  return mediaField.split('|').map(s => s.trim()).filter(Boolean)
}

/**
 * Parse activities.csv and return both activities and media mappings
 */
export async function parseActivitiesWithMedia(
  csvPath: string,
  athleteId: number
): Promise<{
  activities: StravaActivity[]
  mediaByActivityId: Map<string, string[]>
  filenameByActivityId: Map<string, string>
}> {
  const content = await fs.readFile(csvPath, 'utf-8')
  const rows = parseCSVContent(content)

  const dataRows = rows.slice(1)

  const activities: StravaActivity[] = []
  const mediaByActivityId = new Map<string, string[]>()
  const filenameByActivityId = new Map<string, string>()

  for (const fields of dataRows) {
    if (!fields[0] || !fields[0].trim()) continue

    const csvRow = rowToCsvRow(fields)
    const activity = csvRowToActivity(csvRow, athleteId)
    activities.push(activity)

    // Extract media references
    const mediaRefs = extractMediaReferences(csvRow.media)
    if (mediaRefs.length > 0) {
      mediaByActivityId.set(csvRow.activityId, mediaRefs)
    }

    // Store FIT filename mapping
    if (csvRow.filename) {
      filenameByActivityId.set(csvRow.activityId, csvRow.filename)
    }
  }

  return { activities, mediaByActivityId, filenameByActivityId }
}
