'use client'

import { useState, useEffect, useRef } from 'react'

// Fixture images for thumbnail display
const FIXTURES = [
  { id: 'landscape1', path: '/fixtures/photos/kg0JdToiPHrVlA-zj-l7-wodK-NtwuWX2II2bAS9WKw-768x576.jpg', width: 768, height: 576 },
  { id: 'portrait1', path: '/fixtures/photos/S-ACdwp9_oZFE3eQw4RmwnZp_SASOvNgRAqelVZF9nA-576x768.jpg', width: 576, height: 768 },
  { id: 'landscape2', path: '/fixtures/photos/ihlXEIUXq2_yAZ-WxIPdUNVtlVY7pXVyltagSzlldCU-768x576.jpg', width: 768, height: 576 },
  { id: 'portrait2', path: '/fixtures/photos/bIFOxDiA9g0nD45Ehhcr4xs8_JSO6xdeSEhaZLoujzY-576x768.jpg', width: 576, height: 768 },
  { id: 'portrait3', path: '/fixtures/photos/onC_jOkSVGvnxNfZpsNrjkrzO25b5gAY6uaQY2uV7UQ-576x768.jpg', width: 576, height: 768 },
  { id: 'portrait4', path: '/fixtures/photos/SgavsCEdms63bIZwetCJoCgX2T1r4yFBQG8mfP2Di7M-576x768.jpg', width: 576, height: 768 },
  { id: 'landscape3', path: '/fixtures/photos/_kdKb6gRwo3vf0SL51r4eRwkuI06aJUBfDNF6epJDBk-768x576.jpg', width: 768, height: 576 },
]

type ContainerPreset = { name: string; width: number; height: number }

const CONTAINER_PRESETS: ContainerPreset[] = [
  { name: 'Wide', width: 400, height: 200 },
  { name: 'Landscape', width: 400, height: 300 },
  { name: 'Square', width: 300, height: 300 },
  { name: 'Portrait', width: 250, height: 350 },
  { name: 'Tall', width: 200, height: 400 },
]

export default function PdfImageCollectionPage() {
  const [containerWidth, setContainerWidth] = useState(400)
  const [containerHeight, setContainerHeight] = useState(300)
  const [photoCount, setPhotoCount] = useState(4)
  const [gap, setGap] = useState(4)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Determine orientation for display
  const orientation = containerWidth / containerHeight > 1.2 ? 'Wide' : containerWidth / containerHeight < 0.83 ? 'Tall' : 'Square'

  // Debounced PDF generation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          containerWidth: containerWidth.toString(),
          containerHeight: containerHeight.toString(),
          photoCount: photoCount.toString(),
          gap: gap.toString(),
          _t: Date.now().toString(), // Cache buster
        })

        const response = await fetch(`/api/test/pdf-image-collection?${params}`)
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)

          // Clean up old URL
          if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl)
          }

          setPdfUrl(url)
        }
      } catch (error) {
        console.error('Failed to generate PDF:', error)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [containerWidth, containerHeight, photoCount, gap])

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-2">PdfImageCollection Test</h1>
      <p className="text-gray-400 mb-6">Test multi-photo layout arrangements based on photo count and container orientation</p>

      <div className="flex gap-8">
        {/* PDF Preview */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">
              PDF Preview
              {loading && <span className="ml-2 text-yellow-400">(generating...)</span>}
            </h2>
            <div className="bg-white rounded" style={{ height: '700px' }}>
              {pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full rounded"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Loading...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="w-96 space-y-6">
          {/* Photo Count */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Photo Count</h2>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                <button
                  key={count}
                  onClick={() => setPhotoCount(count)}
                  className={`w-10 h-10 rounded font-bold transition-all ${
                    photoCount === count
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-gray-400">
              {photoCount <= 4 ? `Showing all ${photoCount} photos` : `Showing 4 photos with +${photoCount - 4} overlay`}
            </p>
          </div>

          {/* Container Presets */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Container Presets</h2>
            <div className="grid grid-cols-5 gap-2">
              {CONTAINER_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setContainerWidth(preset.width)
                    setContainerHeight(preset.height)
                  }}
                  className={`p-2 rounded text-xs transition-all ${
                    containerWidth === preset.width && containerHeight === preset.height
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Container Dimensions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Container Size</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Width: {containerWidth}pt
                </label>
                <input
                  type="range"
                  min="100"
                  max="500"
                  value={containerWidth}
                  onChange={(e) => setContainerWidth(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Height: {containerHeight}pt
                </label>
                <input
                  type="range"
                  min="100"
                  max="500"
                  value={containerHeight}
                  onChange={(e) => setContainerHeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Gap: {gap}pt
                </label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={gap}
                  onChange={(e) => setGap(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Available Photos */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Available Photos ({FIXTURES.length})</h2>
            <div className="grid grid-cols-4 gap-2">
              {FIXTURES.slice(0, photoCount).map((fixture, idx) => (
                <div
                  key={fixture.id}
                  className="relative rounded overflow-hidden border-2 border-blue-500"
                >
                  <img
                    src={fixture.path}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-16 object-cover"
                  />
                  <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-1">
                    {idx + 1}
                  </div>
                </div>
              ))}
              {FIXTURES.slice(photoCount).map((fixture) => (
                <div
                  key={fixture.id}
                  className="relative rounded overflow-hidden border border-gray-600 opacity-40"
                >
                  <img
                    src={fixture.path}
                    alt="Unused"
                    className="w-full h-16 object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Debug Info */}
          <div className="bg-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400">
            <div>Container: {containerWidth}×{containerHeight}pt</div>
            <div>Orientation: {orientation}</div>
            <div>Aspect ratio: {(containerWidth / containerHeight).toFixed(2)}</div>
            <div>Photos: {photoCount} (showing {Math.min(photoCount, 4)})</div>
            <div>Gap: {gap}pt</div>
          </div>

          {/* Layout Preview */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Expected Layout</h2>
            <div className="text-sm text-gray-300">
              {photoCount === 1 && 'Single photo fills entire container'}
              {photoCount === 2 && orientation === 'Wide' && 'Side-by-side (horizontal split)'}
              {photoCount === 2 && orientation !== 'Wide' && 'Stacked vertically'}
              {photoCount === 3 && orientation === 'Wide' && '1 large left + 2 stacked right'}
              {photoCount === 3 && orientation === 'Tall' && '1 large top + 2 side-by-side bottom'}
              {photoCount === 3 && orientation === 'Square' && '1 large left + 2 stacked right'}
              {photoCount >= 4 && '2×2 grid'}
              {photoCount > 4 && ` with +${photoCount - 4} overlay on last photo`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
