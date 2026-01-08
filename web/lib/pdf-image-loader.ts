/**
 * PDF Image Loader
 *
 * Handles image loading for server-side PDF rendering with @react-pdf/renderer.
 *
 * The challenge: @react-pdf/renderer needs either:
 * 1. Absolute file paths to local images
 * 2. Full HTTP(S) URLs (which it will fetch)
 * 3. Base64 data URLs
 *
 * It does NOT support:
 * - Relative paths like `/api/proxy-image?url=...` (interprets as file path -> ENOENT)
 *
 * This module provides utilities to convert image references to a format
 * that @react-pdf/renderer can handle during server-side rendering.
 */

import * as fs from 'fs'
import * as path from 'path'

// Cache for fetched images to avoid re-fetching
const imageCache = new Map<string, string>()

/**
 * Fetch an image URL and return it as a base64 data URL
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  // Check cache first
  if (imageCache.has(url)) {
    return imageCache.get(url)!
  }

  try {
    console.log(`[pdf-image-loader] Fetching: ${url}`)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Strava-Book-PDF-Generator/1.0',
      },
    })

    if (!response.ok) {
      console.error(`[pdf-image-loader] Failed to fetch ${url}: ${response.status}`)
      return null
    }

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const dataUrl = `data:${contentType};base64,${base64}`

    // Cache the result
    imageCache.set(url, dataUrl)
    console.log(`[pdf-image-loader] Cached image: ${url.substring(0, 50)}... (${buffer.byteLength} bytes)`)

    return dataUrl
  } catch (error) {
    console.error(`[pdf-image-loader] Error fetching ${url}:`, error)
    return null
  }
}

/**
 * Read a local file and return it as a base64 data URL
 */
function readLocalImageAsBase64(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[pdf-image-loader] File not found: ${filePath}`)
      return null
    }

    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }
    const contentType = mimeTypes[ext] || 'image/jpeg'
    const base64 = buffer.toString('base64')

    return `data:${contentType};base64,${base64}`
  } catch (error) {
    console.error(`[pdf-image-loader] Error reading ${filePath}:`, error)
    return null
  }
}

/**
 * Resolve an image URL or path for use in PDF rendering.
 *
 * This function handles:
 * 1. External HTTP(S) URLs -> returns the URL (react-pdf can fetch these)
 * 2. Absolute file paths -> returns the path (react-pdf can read these)
 * 3. Relative paths starting with 'photos/' -> resolves to fixture photos directory
 * 4. API proxy URLs -> extracts original URL and returns it for direct fetch
 *
 * @param url The image URL or path
 * @param basePath Optional base path for resolving relative paths
 * @returns Resolved URL/path suitable for @react-pdf/renderer, or null if invalid
 */
export function resolveImageForPdf(
  url: string | undefined | null,
  basePath?: string
): string | null {
  if (!url) return null

  // Already a data URL - return as-is
  if (url.startsWith('data:')) {
    return url
  }

  // HTTP(S) URLs - react-pdf can fetch these directly
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // API proxy URL - extract the original URL
  // Format: /api/proxy-image?url=<encoded-url>
  if (url.startsWith('/api/proxy-image')) {
    const match = url.match(/[?&]url=([^&]+)/)
    if (match) {
      const decodedUrl = decodeURIComponent(match[1])
      // Return the original URL - react-pdf will fetch it directly
      return decodedUrl
    }
    return null
  }

  // Absolute file path (Unix or Windows)
  if (url.startsWith('/') || /^[A-Za-z]:[\\/]/.test(url)) {
    if (fs.existsSync(url)) {
      return url
    }
    console.warn(`[pdf-image-loader] File not found: ${url}`)
    return null
  }

  // Relative path - resolve against base path
  if (basePath) {
    const absolutePath = path.resolve(basePath, url)
    if (fs.existsSync(absolutePath)) {
      return absolutePath
    }
    console.warn(`[pdf-image-loader] Resolved file not found: ${absolutePath}`)
  }

  // Try resolving relative to fixtures directory
  const fixturesDir = path.join(__dirname, 'testing', 'fixtures')
  const fixturesPath = path.resolve(fixturesDir, url)
  if (fs.existsSync(fixturesPath)) {
    return fixturesPath
  }

  console.warn(`[pdf-image-loader] Unable to resolve: ${url}`)
  return null
}

/**
 * Prepare an image for PDF rendering by ensuring it's in a loadable format.
 *
 * For server-side rendering:
 * - External URLs are returned directly (react-pdf fetches them)
 * - Local files are returned as absolute paths
 * - Proxy URLs are converted to direct URLs
 *
 * @param url The image URL or path
 * @param options Configuration options
 * @returns Promise resolving to a URL/path that react-pdf can load
 */
export async function prepareImageForPdf(
  url: string | undefined | null,
  options: {
    basePath?: string
    useBase64?: boolean  // Force conversion to base64 (useful for avoiding CORS)
  } = {}
): Promise<string | null> {
  const resolved = resolveImageForPdf(url, options.basePath)
  if (!resolved) return null

  // If base64 is requested, convert it
  if (options.useBase64) {
    if (resolved.startsWith('http')) {
      return fetchImageAsBase64(resolved)
    }
    if (fs.existsSync(resolved)) {
      return readLocalImageAsBase64(resolved)
    }
  }

  return resolved
}

/**
 * Batch prepare multiple images for PDF rendering.
 * Useful for preparing all photos in an activity before rendering.
 *
 * @param urls Array of image URLs or paths
 * @param options Configuration options
 * @returns Map of original URL to resolved URL
 */
export async function prepareImagesForPdf(
  urls: (string | undefined | null)[],
  options: {
    basePath?: string
    useBase64?: boolean
  } = {}
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  await Promise.all(
    urls.map(async (url) => {
      if (url) {
        const resolved = await prepareImageForPdf(url, options)
        results.set(url, resolved)
      }
    })
  )

  return results
}

/**
 * Clear the image cache.
 * Useful for freeing memory after generating a large PDF.
 */
export function clearImageCache(): void {
  imageCache.clear()
}

/**
 * Get cache statistics for debugging.
 */
export function getImageCacheStats(): { size: number; keys: string[] } {
  return {
    size: imageCache.size,
    keys: Array.from(imageCache.keys()),
  }
}
