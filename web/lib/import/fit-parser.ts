/**
 * FIT File Parser for Strava Export
 *
 * Parses .fit.gz files from the Strava export to extract GPS data
 * and generate polyline encodings for map rendering.
 */

import { promises as fs } from 'fs'
import { gunzipSync } from 'zlib'
import FitParser from 'fit-file-parser'
import * as polylineCodec from '@mapbox/polyline'

export interface FitRecord {
  timestamp?: Date
  position_lat?: number
  position_long?: number
  altitude?: number
  heart_rate?: number
  cadence?: number
  distance?: number
  speed?: number
  power?: number
}

export interface FitLap {
  timestamp?: Date
  start_time?: Date
  total_elapsed_time?: number
  total_timer_time?: number
  total_distance?: number
  total_ascent?: number
  avg_speed?: number
  max_speed?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_cadence?: number
  avg_power?: number
}

export interface ParsedFitData {
  records: FitRecord[]
  laps: FitLap[]
  startPosition: [number, number] | null
  endPosition: [number, number] | null
  summaryPolyline: string
}

/**
 * Convert FIT semicircle coordinates to degrees
 * FIT uses semicircles: 1 semicircle = 180/2^31 degrees
 */
function semicirclesToDegrees(semicircles: number): number {
  return semicircles * (180 / Math.pow(2, 31))
}

/**
 * Simplify a GPS track using Douglas-Peucker algorithm
 * This reduces the number of points for polyline encoding
 */
function simplifyTrack(
  points: [number, number][],
  epsilon: number = 0.00005
): [number, number][] {
  if (points.length <= 2) return points

  // Find point with maximum distance from line between first and last
  let maxDist = 0
  let maxIdx = 0

  const [startLat, startLng] = points[0]
  const [endLat, endLng] = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const [lat, lng] = points[i]
    const dist = perpendicularDistance(lat, lng, startLat, startLng, endLat, endLng)
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyTrack(points.slice(0, maxIdx + 1), epsilon)
    const right = simplifyTrack(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[points.length - 1]]
}

function perpendicularDistance(
  lat: number, lng: number,
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dx = lat2 - lat1
  const dy = lng2 - lng1

  if (dx === 0 && dy === 0) {
    return Math.sqrt((lat - lat1) ** 2 + (lng - lng1) ** 2)
  }

  const t = Math.max(0, Math.min(1, ((lat - lat1) * dx + (lng - lng1) * dy) / (dx * dx + dy * dy)))
  const projLat = lat1 + t * dx
  const projLng = lng1 + t * dy

  return Math.sqrt((lat - projLat) ** 2 + (lng - projLng) ** 2)
}

/**
 * Parse a .fit.gz file and extract GPS/sensor data
 */
export async function parseFitFile(filePath: string): Promise<ParsedFitData> {
  const compressed = await fs.readFile(filePath)
  const buffer = gunzipSync(compressed)

  // Only .fit.gz files are supported (not .tcx.gz or .gpx)
  if (!filePath.endsWith('.fit.gz') && !filePath.endsWith('.fit')) {
    return {
      records: [],
      laps: [],
      startPosition: null,
      endPosition: null,
      summaryPolyline: '',
    }
  }

  return new Promise((resolve, reject) => {
    const fitParser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fitParser.parse(buffer, (error: any, data: any) => {
      if (error) {
        reject(new Error(String(error)))
        return
      }

      const records: FitRecord[] = data?.records || []
      const laps: FitLap[] = data?.laps || []

      // Extract GPS coordinates
      const gpsPoints: [number, number][] = []
      for (const record of records) {
        if (record.position_lat != null && record.position_long != null) {
          let lat = record.position_lat
          let lng = record.position_long

          // FIT files may store positions as semicircles
          // Values > 90 or < -90 for lat indicate semicircle format
          if (Math.abs(lat) > 90) {
            lat = semicirclesToDegrees(lat)
            lng = semicirclesToDegrees(lng)
          }

          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            gpsPoints.push([lat, lng])
          }
        }
      }

      const startPosition = gpsPoints.length > 0 ? gpsPoints[0] : null
      const endPosition = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null

      // Generate summary polyline (simplified)
      let summaryPolyline = ''
      if (gpsPoints.length > 0) {
        const simplified = simplifyTrack(gpsPoints, 0.00008)
        summaryPolyline = polylineCodec.encode(simplified)
      }

      resolve({
        records,
        laps,
        startPosition,
        endPosition,
        summaryPolyline,
      })
    })
  })
}

/**
 * Parse a FIT file and return just the polyline + coordinates
 * (lighter weight for batch processing)
 */
export async function parseFitForPolyline(filePath: string): Promise<{
  summaryPolyline: string
  startLatlng: [number, number] | null
  endLatlng: [number, number] | null
}> {
  try {
    const result = await parseFitFile(filePath)
    return {
      summaryPolyline: result.summaryPolyline,
      startLatlng: result.startPosition,
      endLatlng: result.endPosition,
    }
  } catch {
    return {
      summaryPolyline: '',
      startLatlng: null,
      endLatlng: null,
    }
  }
}
