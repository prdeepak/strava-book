/**
 * PdfImageCollection - Primitive for arranging multiple photos in a container
 *
 * Uses a grid-based algorithm:
 * 1. Find the smallest grid where rows×cols >= N photos
 * 2. Grid aspect ratio matches container aspect ratio
 * 3. Merge adjacent cells to reduce cell count to exactly N
 * 4. Each photo fills one cell with proper aspect-fill
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import { PdfImage } from './PdfImage'

export interface CollectionPhoto {
  /** Image URL */
  url: string
  /** Source image width in pixels (for precise aspect-fill) */
  width?: number
  /** Source image height in pixels (for precise aspect-fill) */
  height?: number
}

export interface PdfImageCollectionProps {
  /** Array of photos to display */
  photos: CollectionPhoto[]
  /** Container width in points */
  containerWidth: number
  /** Container height in points */
  containerHeight: number
  /** Gap between photos in points (default: 4) */
  gap?: number
  /** Border radius for photos (default: 0) */
  borderRadius?: number
}

interface LayoutCell {
  /** Grid row start (0-indexed) */
  row: number
  /** Grid column start (0-indexed) */
  col: number
  /** Number of rows this cell spans */
  rowSpan: number
  /** Number of columns this cell spans */
  colSpan: number
}

interface GridLayout {
  rows: number
  cols: number
  cells: LayoutCell[]
}

/**
 * Find the best grid dimensions for N photos in a container
 */
function findBestGrid(n: number, containerWidth: number, containerHeight: number): { rows: number; cols: number } {
  if (n <= 0) return { rows: 0, cols: 0 }
  if (n === 1) return { rows: 1, cols: 1 }

  const targetRatio = containerWidth / containerHeight

  let bestGrid = { rows: 1, cols: n }
  let bestScore = Infinity

  // Try all possible row counts
  for (let rows = 1; rows <= n; rows++) {
    const cols = Math.ceil(n / rows)
    const totalCells = rows * cols

    if (totalCells < n) continue

    const gridRatio = cols / rows
    const ratioError = Math.abs(gridRatio - targetRatio) / Math.max(targetRatio, 0.01)
    const excessCells = totalCells - n

    // Score: prioritize ratio match, then fewer excess cells
    const score = ratioError * 10 + excessCells

    if (score < bestScore) {
      bestScore = score
      bestGrid = { rows, cols }
    }
  }

  return bestGrid
}

/**
 * Generate cell layout by merging cells in the base grid
 */
function generateCellLayout(n: number, rows: number, cols: number): LayoutCell[] {
  if (n <= 0) return []

  const totalCells = rows * cols
  const mergesNeeded = totalCells - n

  if (mergesNeeded === 0) {
    // Perfect fit - no merging needed
    const cells: LayoutCell[] = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ row: r, col: c, rowSpan: 1, colSpan: 1 })
      }
    }
    return cells
  }

  // Create a grid to track which cells are used/merged
  // Values: -1 = merged into another, index = cell index that owns this space
  const grid: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(-2)) // -2 = unassigned

  const cells: LayoutCell[] = []
  let cellIndex = 0
  let mergesDone = 0

  // Strategy: iterate through grid, sometimes create merged cells
  // Spread merges evenly by using a pattern based on position
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== -2) continue // Already used
      if (cellIndex >= n) break

      // Decide if we should merge
      const shouldMerge = mergesDone < mergesNeeded
      let merged = false

      if (shouldMerge) {
        // Alternate between horizontal and vertical merges based on position
        const preferHorizontal = (r + c) % 2 === 0

        if (preferHorizontal && c + 1 < cols && grid[r][c + 1] === -2) {
          // Horizontal merge (1×2)
          cells.push({ row: r, col: c, rowSpan: 1, colSpan: 2 })
          grid[r][c] = cellIndex
          grid[r][c + 1] = -1 // Merged into this cell
          merged = true
          mergesDone++
        } else if (!preferHorizontal && r + 1 < rows && grid[r + 1][c] === -2) {
          // Vertical merge (2×1)
          cells.push({ row: r, col: c, rowSpan: 2, colSpan: 1 })
          grid[r][c] = cellIndex
          grid[r + 1][c] = -1 // Merged into this cell
          merged = true
          mergesDone++
        } else if (c + 1 < cols && grid[r][c + 1] === -2) {
          // Fallback to horizontal if vertical not possible
          cells.push({ row: r, col: c, rowSpan: 1, colSpan: 2 })
          grid[r][c] = cellIndex
          grid[r][c + 1] = -1
          merged = true
          mergesDone++
        } else if (r + 1 < rows && grid[r + 1][c] === -2) {
          // Fallback to vertical if horizontal not possible
          cells.push({ row: r, col: c, rowSpan: 2, colSpan: 1 })
          grid[r][c] = cellIndex
          grid[r + 1][c] = -1
          merged = true
          mergesDone++
        }
      }

      if (!merged) {
        // Single cell
        cells.push({ row: r, col: c, rowSpan: 1, colSpan: 1 })
        grid[r][c] = cellIndex
      }

      cellIndex++
    }
  }

  return cells.slice(0, n)
}

/**
 * Convert grid cells to pixel positions
 */
function cellsToSlots(
  cells: LayoutCell[],
  rows: number,
  cols: number,
  containerWidth: number,
  containerHeight: number,
  gap: number
): { x: number; y: number; width: number; height: number }[] {
  // Calculate cell dimensions (accounting for gaps)
  const totalGapWidth = gap * (cols - 1)
  const totalGapHeight = gap * (rows - 1)
  const cellWidth = (containerWidth - totalGapWidth) / cols
  const cellHeight = (containerHeight - totalGapHeight) / rows

  return cells.map(cell => {
    const x = cell.col * (cellWidth + gap)
    const y = cell.row * (cellHeight + gap)
    // Width/height includes the spanned cells plus gaps between them
    const width = cell.colSpan * cellWidth + (cell.colSpan - 1) * gap
    const height = cell.rowSpan * cellHeight + (cell.rowSpan - 1) * gap

    return { x, y, width, height }
  })
}

/**
 * PdfImageCollection arranges multiple photos in a container using a grid-based algorithm.
 */
export const PdfImageCollection = ({
  photos,
  containerWidth,
  containerHeight,
  gap = 4,
  borderRadius = 0
}: PdfImageCollectionProps) => {
  if (photos.length === 0) {
    return null
  }

  const n = photos.length

  // Find optimal grid
  const { rows, cols } = findBestGrid(n, containerWidth, containerHeight)

  // Generate cell layout with merges
  const cells = generateCellLayout(n, rows, cols)

  // Convert to pixel positions
  const slots = cellsToSlots(cells, rows, cols, containerWidth, containerHeight, gap)

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: containerWidth,
      height: containerHeight,
    },
    slot: {
      position: 'absolute',
      overflow: 'hidden',
      backgroundColor: '#e5e5e5',
    },
  })

  return (
    <View style={styles.container}>
      {slots.map((slot, idx) => {
        const photo = photos[idx]
        if (!photo) return null

        return (
          <View
            key={idx}
            style={[
              styles.slot,
              {
                left: slot.x,
                top: slot.y,
                width: slot.width,
                height: slot.height,
                ...(borderRadius > 0 ? { borderRadius } : {}),
              }
            ]}
          >
            <PdfImage
              src={photo.url}
              containerWidth={slot.width}
              containerHeight={slot.height}
              sourceWidth={photo.width}
              sourceHeight={photo.height}
              {...(borderRadius > 0 ? { borderRadius } : {})}
            />
          </View>
        )
      })}
    </View>
  )
}

export default PdfImageCollection
