/**
 * PDF to Images Conversion
 *
 * Uses poppler-utils (pdftoppm) to convert PDF pages to PNG images.
 * This module provides utilities for extracting individual pages
 * from a PDF for visual judging.
 */

import { execSync, exec } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// ============================================================================
// Types
// ============================================================================

export interface PageImage {
  pageNumber: number
  imagePath: string
}

export interface ExtractionResult {
  tempDir: string
  pages: PageImage[]
  totalPages: number
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if pdftoppm is available on the system
 */
export async function isPdftoppmAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    exec('which pdftoppm', (error) => {
      resolve(!error)
    })
  })
}

/**
 * Get the number of pages in a PDF
 */
export async function getPdfPageCount(pdfPath: string): Promise<number> {
  try {
    const output = execSync(`pdfinfo "${pdfPath}" | grep Pages | awk '{print $2}'`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return parseInt(output, 10) || 0
  } catch {
    // Fallback: try extracting all pages and count
    return 0
  }
}

/**
 * Extract all pages from a PDF buffer as PNG images
 *
 * @param pdfBuffer - The PDF data as a Buffer
 * @param options - Extraction options
 * @returns ExtractionResult with output directory and page image paths
 */
export async function extractPdfPages(
  pdfBuffer: Buffer,
  options: {
    resolution?: number  // DPI (default: 150)
    prefix?: string      // File prefix (default: 'page')
    outputDir?: string   // Custom output directory (default: temp dir)
  } = {}
): Promise<ExtractionResult> {
  const { resolution = 150, prefix = 'page', outputDir } = options

  // Use custom output dir or create temp directory
  const tempDir = outputDir
    ? outputDir
    : await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-pages-'))

  // Ensure directory exists
  await fs.mkdir(tempDir, { recursive: true })

  const pdfPath = path.join(tempDir, 'input.pdf')

  // Write PDF to temp file
  await fs.writeFile(pdfPath, pdfBuffer)

  try {
    // Convert PDF to PNG images using pdftoppm
    // Output format: {prefix}-{page_number}.png
    execSync(
      `pdftoppm -png -r ${resolution} "${pdfPath}" "${path.join(tempDir, prefix)}"`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    )

    // Find all generated PNG files
    const files = await fs.readdir(tempDir)
    const pngFiles = files.filter(f => f.endsWith('.png')).sort()

    const pages: PageImage[] = pngFiles.map((file) => {
      // Extract page number from filename (e.g., "page-01.png" -> 1)
      const match = file.match(/-(\d+)\.png$/)
      const pageNumber = match ? parseInt(match[1], 10) : 1
      return {
        pageNumber,
        imagePath: path.join(tempDir, file),
      }
    })

    // Clean up PDF file
    await fs.unlink(pdfPath).catch(() => {})

    return {
      tempDir,
      pages,
      totalPages: pages.length,
    }
  } catch (error) {
    // Clean up on error
    await cleanupTempDir(tempDir)
    throw new Error(`Failed to extract PDF pages: ${error}`)
  }
}

/**
 * Extract specific pages from a PDF buffer
 *
 * @param pdfBuffer - The PDF data as a Buffer
 * @param pageNumbers - Array of page numbers to extract (1-indexed)
 * @param options - Extraction options
 * @returns ExtractionResult with only the requested pages
 */
export async function extractSpecificPages(
  pdfBuffer: Buffer,
  pageNumbers: number[],
  options: {
    resolution?: number
    prefix?: string
  } = {}
): Promise<ExtractionResult> {
  const { resolution = 150, prefix = 'page' } = options

  // Create temp directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-pages-'))
  const pdfPath = path.join(tempDir, 'input.pdf')

  // Write PDF to temp file
  await fs.writeFile(pdfPath, pdfBuffer)

  const pages: PageImage[] = []

  try {
    for (const pageNum of pageNumbers) {
      const outputPath = path.join(tempDir, `${prefix}-${String(pageNum).padStart(3, '0')}.png`)

      // Convert single page
      execSync(
        `pdftoppm -png -f ${pageNum} -l ${pageNum} -r ${resolution} -singlefile "${pdfPath}" "${outputPath.replace('.png', '')}"`,
        { stdio: ['pipe', 'pipe', 'pipe'] }
      )

      // Check if file was created
      const actualPath = outputPath
      try {
        await fs.access(actualPath)
        pages.push({
          pageNumber: pageNum,
          imagePath: actualPath,
        })
      } catch {
        // Page might not exist or extraction failed
        console.warn(`[PdfToImages] Failed to extract page ${pageNum}`)
      }
    }

    // Clean up PDF file
    await fs.unlink(pdfPath).catch(() => {})

    return {
      tempDir,
      pages,
      totalPages: pages.length,
    }
  } catch (error) {
    // Clean up on error
    await cleanupTempDir(tempDir)
    throw new Error(`Failed to extract PDF pages: ${error}`)
  }
}

/**
 * Clean up temporary directory and all its contents
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    const files = await fs.readdir(tempDir)
    await Promise.all(
      files.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
    )
    await fs.rmdir(tempDir)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Extract a sample of pages for book-level evaluation
 * Selects cover, back cover, and representative middle pages
 *
 * @param pdfBuffer - The PDF data as a Buffer
 * @param totalPages - Total number of pages in the PDF
 * @param sampleSize - Number of pages to sample (default: 5)
 * @returns ExtractionResult with sample pages
 */
export async function extractSamplePages(
  pdfBuffer: Buffer,
  totalPages: number,
  sampleSize: number = 5
): Promise<ExtractionResult> {
  // Always include first and last page
  const pageNumbers = new Set<number>([1, totalPages])

  // Add evenly distributed middle pages
  const middleCount = Math.min(sampleSize - 2, totalPages - 2)
  for (let i = 1; i <= middleCount; i++) {
    const pageNum = Math.floor((i * totalPages) / (middleCount + 1))
    if (pageNum > 1 && pageNum < totalPages) {
      pageNumbers.add(pageNum)
    }
  }

  return extractSpecificPages(pdfBuffer, Array.from(pageNumbers).sort((a, b) => a - b))
}
