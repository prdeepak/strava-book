/**
 * Photo Mapper for Strava Export
 *
 * Maps photos from the Strava export's media/ directory to activities.
 * Uses the Media column in activities.csv for direct mapping.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { StravaPhoto } from '../strava'

/**
 * Parse media.csv to get captions for media files
 */
export async function parseMediaCSV(mediaCSVPath: string): Promise<Map<string, string>> {
  const content = await fs.readFile(mediaCSVPath, 'utf-8')
  const lines = content.split('\n')
  const captions = new Map<string, string>()

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parse CSV line: "Media Filename,Media Caption"
    // Handle quoted fields
    let filename = ''
    let caption = ''

    if (line.startsWith('"')) {
      // Quoted filename
      const endQuote = line.indexOf('"', 1)
      filename = line.substring(1, endQuote)
      const rest = line.substring(endQuote + 2) // skip ","
      caption = rest.replace(/^"|"$/g, '')
    } else {
      const commaIdx = line.indexOf(',')
      if (commaIdx === -1) continue
      filename = line.substring(0, commaIdx)
      caption = line.substring(commaIdx + 1).replace(/^"|"$/g, '')
    }

    if (filename) {
      captions.set(filename, caption)
    }
  }

  return captions
}

/**
 * Check if a media file is a photo (not a video)
 */
function isPhoto(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'].includes(ext)
}

/**
 * Get image dimensions from a JPEG file (basic parser)
 */
async function getJpegDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const buffer = await fs.readFile(filePath)

    // Look for JPEG SOF markers
    for (let i = 0; i < buffer.length - 10; i++) {
      if (buffer[i] === 0xFF) {
        const marker = buffer[i + 1]
        // SOF0 through SOF3 (excluding DHT=0xC4)
        if (marker >= 0xC0 && marker <= 0xC3) {
          const height = buffer.readUInt16BE(i + 5)
          const width = buffer.readUInt16BE(i + 7)
          if (width > 0 && height > 0) {
            return { width, height }
          }
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Directory where imported photos are copied into the cache.
 * Photos are stored here so the Docker image is self-contained
 * (no dependency on the original export folder at render time).
 */
const PHOTOS_CACHE_DIR = path.join(process.cwd(), '.cache', 'strava', 'photos')

/**
 * Copy a photo into the cache and return the cache-relative path.
 * Uses the photo's unique basename to avoid collisions.
 */
async function copyPhotoToCache(
  sourcePath: string,
  filename: string
): Promise<string> {
  await fs.mkdir(PHOTOS_CACHE_DIR, { recursive: true })
  const destPath = path.join(PHOTOS_CACHE_DIR, filename)

  // Skip if already copied
  try {
    await fs.access(destPath)
  } catch {
    await fs.copyFile(sourcePath, destPath)
  }

  // Return cache-relative path (resolved by pdf-image-loader at render time)
  return `cache-photo://${filename}`
}

/**
 * Map media files to activities as StravaPhoto[]
 *
 * @param exportDir - Root of the Strava export (contains media/ and media.csv)
 * @param mediaByActivityId - Map from activity ID to media file paths (from CSV parser)
 * @param activityNames - Map from activity ID to activity name (for photo metadata)
 */
export async function mapPhotosToActivities(
  exportDir: string,
  mediaByActivityId: Map<string, string[]>,
  activityNames: Map<string, string>,
  athleteId: number
): Promise<Map<string, StravaPhoto[]>> {
  // Parse media.csv for captions
  const mediaCsvPath = path.join(exportDir, 'media.csv')
  let captions = new Map<string, string>()
  try {
    captions = await parseMediaCSV(mediaCsvPath)
  } catch {
    // media.csv may not exist — that's fine
  }

  const photosByActivityId = new Map<string, StravaPhoto[]>()

  for (const [activityId, mediaRefs] of mediaByActivityId) {
    const photos: StravaPhoto[] = []

    for (const mediaRef of mediaRefs) {
      if (!isPhoto(mediaRef)) continue

      const fullPath = path.join(exportDir, mediaRef)

      // Check if file exists
      try {
        await fs.access(fullPath)
      } catch {
        continue // File doesn't exist, skip
      }

      // Extract UUID from filename
      const basename = path.basename(mediaRef, path.extname(mediaRef))
      const ext = path.extname(mediaRef)
      const caption = captions.get(mediaRef) || ''

      // Copy photo into cache so the app is self-contained
      const cachedUrl = await copyPhotoToCache(fullPath, `${basename}${ext}`)

      // Get dimensions
      const dims = await getJpegDimensions(fullPath)

      const photo: StravaPhoto = {
        unique_id: basename,
        urls: {
          '5000': cachedUrl,
        },
        source: 1,
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        caption: caption || undefined,
        activity_id: parseInt(activityId, 10),
      }

      // Add sizes if we got dimensions
      if (dims) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (photo as any).sizes = {
          '5000': [dims.width, dims.height],
        }
      }

      // Add extra metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const photoAny = photo as any
      photoAny.athlete_id = athleteId
      photoAny.activity_name = activityNames.get(activityId) || ''
      photoAny.resource_state = 2
      photoAny.type = 1
      photoAny.status = 3

      photos.push(photo)
    }

    if (photos.length > 0) {
      photosByActivityId.set(activityId, photos)
    }
  }

  return photosByActivityId
}
