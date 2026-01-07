import { BookFormat } from './book-types'

/**
 * Calculate how many activities can fit on one page based on format size
 */
export function calculateActivitiesPerPage(format: BookFormat): number {
  // Base calculation: 10x10 format has ~20 activities per page
  // Row height ~30pt (text + spacing), safe area ~630pt (720 - 2*45)
  // Header/title takes ~60pt, leaving ~570pt for rows
  const baseActivitiesPerPage = 20

  // Scale based on format
  // 8x8: fewer activities (smaller page)
  // 10x10: base amount
  // 12x12: more activities (larger page)
  const scaledCount = Math.floor(baseActivitiesPerPage * format.scaleFactor)

  // Ensure reasonable bounds
  return Math.max(10, Math.min(30, scaledCount))
}

/**
 * Format pace as min:sec/unit (e.g., "5:23/km" or "8:42/mi")
 */
export function formatPace(
  movingTime: number,  // in seconds
  distance: number,    // in meters
  units: 'metric' | 'imperial'
): string {
  if (!distance || distance === 0) return '--'

  // Convert distance to km or miles
  const distanceInUnits = units === 'metric'
    ? distance / 1000
    : distance / 1609.34

  // Calculate pace in seconds per unit
  const paceSeconds = movingTime / distanceInUnits

  // Convert to min:sec format
  const paceMin = Math.floor(paceSeconds / 60)
  const paceSec = Math.round(paceSeconds % 60).toString().padStart(2, '0')

  const unitLabel = units === 'metric' ? 'km' : 'mi'
  return `${paceMin}:${paceSec}/${unitLabel}`
}

/**
 * Format distance in km or miles
 */
export function formatDistance(
  distance: number,  // in meters
  units: 'metric' | 'imperial'
): string {
  if (units === 'metric') {
    return `${(distance / 1000).toFixed(2)} km`
  } else {
    return `${(distance / 1609.34).toFixed(2)} mi`
  }
}

/**
 * Format time as HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * Get month name from month index (0-11)
 */
export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month] || 'Unknown'
}
