/**
 * Contact Sheet Generator
 *
 * Stitches individual page PNGs into contact sheets for efficient LLM context.
 * Each contact sheet is a grid of thumbnails with page number labels.
 *
 * Uses the `sharp` npm package for image compositing. If sharp is not available,
 * falls back to a simple file-copy approach (one image per "sheet").
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ============================================================================
// Types
// ============================================================================

export interface ContactSheetOptions {
  pagesPerSheet?: number   // default: 20
  thumbnailWidth?: number  // default: 200
  columns?: number         // default: 5
  outputDir?: string       // default: os.tmpdir()
  labelFontSize?: number   // default: 14
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate contact sheets from individual page PNGs.
 *
 * Each contact sheet arranges thumbnails in a grid (default: 5 columns × 4 rows = 20 per sheet).
 * Page numbers are added as labels below each thumbnail.
 *
 * @param pagePngPaths - Ordered array of paths to page PNG files
 * @param options - Configuration for the contact sheet layout
 * @returns Array of paths to generated contact sheet PNGs
 */
export async function generateContactSheets(
  pagePngPaths: string[],
  options: ContactSheetOptions = {}
): Promise<string[]> {
  const {
    pagesPerSheet = 20,
    thumbnailWidth = 200,
    columns = 5,
    outputDir = os.tmpdir(),
    labelFontSize = 14,
  } = options

  if (pagePngPaths.length === 0) return []

  // Try to use sharp for compositing
  try {
    const sharp = await importSharp()
    return await generateWithSharp(
      sharp, pagePngPaths, { pagesPerSheet, thumbnailWidth, columns, outputDir, labelFontSize }
    )
  } catch {
    // sharp not available — fall back to simple copy approach
    console.warn('[Contact Sheet] sharp not available, using fallback (individual images)')
    return generateFallback(pagePngPaths, outputDir)
  }
}

// ============================================================================
// Sharp-based Implementation
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importSharp(): Promise<any> {
  // Dynamic import so the module is optional
  const sharpModule = await import('sharp')
  return sharpModule.default || sharpModule
}

async function generateWithSharp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sharp: any,
  pagePngPaths: string[],
  opts: Required<ContactSheetOptions>
): Promise<string[]> {
  const { pagesPerSheet, thumbnailWidth, columns, outputDir, labelFontSize } = opts
  const rows = Math.ceil(pagesPerSheet / columns)
  const labelHeight = labelFontSize + 8 // padding around label text
  // Assume square pages (common for this project)
  const thumbnailHeight = thumbnailWidth

  const cellWidth = thumbnailWidth
  const cellHeight = thumbnailHeight + labelHeight

  const sheetWidth = columns * cellWidth
  const sheetHeight = rows * cellHeight

  const contactSheetPaths: string[] = []
  const totalSheets = Math.ceil(pagePngPaths.length / pagesPerSheet)

  for (let sheetIdx = 0; sheetIdx < totalSheets; sheetIdx++) {
    const startIdx = sheetIdx * pagesPerSheet
    const endIdx = Math.min(startIdx + pagesPerSheet, pagePngPaths.length)
    const sheetPages = pagePngPaths.slice(startIdx, endIdx)

    // Create compositing operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const composites: any[] = []

    for (let i = 0; i < sheetPages.length; i++) {
      const col = i % columns
      const row = Math.floor(i / columns)
      const x = col * cellWidth
      const y = row * cellHeight
      const pageNum = startIdx + i + 1

      // Resize page thumbnail
      const thumbnail = await sharp(sheetPages[i])
        .resize(thumbnailWidth, thumbnailHeight, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toBuffer()

      composites.push({
        input: thumbnail,
        left: x,
        top: y,
      })

      // Create page number label
      const labelSvg = Buffer.from(
        `<svg width="${cellWidth}" height="${labelHeight}">
          <rect width="${cellWidth}" height="${labelHeight}" fill="white"/>
          <text x="${cellWidth / 2}" y="${labelHeight - 4}" text-anchor="middle" font-size="${labelFontSize}" font-family="Arial, sans-serif" fill="#333">
            Page ${pageNum}
          </text>
        </svg>`
      )

      composites.push({
        input: labelSvg,
        left: x,
        top: y + thumbnailHeight,
      })
    }

    // Create the contact sheet
    const sheetBuffer = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer()

    const sheetPath = path.join(outputDir, `contact-sheet-${sheetIdx + 1}.png`)
    fs.writeFileSync(sheetPath, sheetBuffer)
    contactSheetPaths.push(sheetPath)
  }

  return contactSheetPaths
}

// ============================================================================
// Fallback Implementation (no sharp)
// ============================================================================

/**
 * Fallback: just copy the individual page images as "contact sheets".
 * Each image becomes its own sheet. This is less efficient for LLM context
 * but works without any image processing dependency.
 */
function generateFallback(
  pagePngPaths: string[],
  outputDir: string
): string[] {
  const sheetPaths: string[] = []

  for (let i = 0; i < pagePngPaths.length; i++) {
    const destPath = path.join(outputDir, `contact-sheet-page-${i + 1}.png`)
    fs.copyFileSync(pagePngPaths[i], destPath)
    sheetPaths.push(destPath)
  }

  return sheetPaths
}
