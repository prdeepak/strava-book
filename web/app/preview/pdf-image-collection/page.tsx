'use client'

import { useState, useEffect, useRef } from 'react'

// Fixture images with their dimensions
const FIXTURES = [
  {
    id: 'landscape',
    label: 'Landscape (768×576)',
    path: '/fixtures/photos/kg0JdToiPHrVlA-zj-l7-wodK-NtwuWX2II2bAS9WKw-768x576.jpg',
    width: 768,
    height: 576,
  },
  {
    id: 'portrait',
    label: 'Portrait (576×768)',
    path: '/fixtures/photos/S-ACdwp9_oZFE3eQw4RmwnZp_SASOvNgRAqelVZF9nA-576x768.jpg',
    width: 576,
    height: 768,
  },
  {
    id: 'landscape2',
    label: 'Landscape 2 (768×576)',
    path: '/fixtures/photos/ihlXEIUXq2_yAZ-WxIPdUNVtlVY7pXVyltagSzlldCU-768x576.jpg',
    width: 768,
    height: 576,
  },
  {
    id: 'portrait2',
    label: 'Portrait 2 (576×768)',
    path: '/fixtures/photos/bIFOxDiA9g0nD45Ehhcr4xs8_JSO6xdeSEhaZLoujzY-576x768.jpg',
    width: 576,
    height: 768,
  },
]

export default function PdfImageCollectionPage() {
  const [containerWidth, setContainerWidth] = useState(300)
  const [containerHeight, setContainerHeight] = useState(200)
  const [selectedFixture, setSelectedFixture] = useState(FIXTURES[0])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

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
          imagePath: selectedFixture.path,
          sourceWidth: selectedFixture.width.toString(),
          sourceHeight: selectedFixture.height.toString(),
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
  }, [containerWidth, containerHeight, selectedFixture])

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
      <h1 className="text-2xl font-bold mb-6">PdfImage Test Collection</h1>

      <div className="flex gap-8">
        {/* PDF Preview */}
        <div className="flex-1">
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">
              PDF Preview
              {loading && <span className="ml-2 text-yellow-400">(generating...)</span>}
            </h2>
            <div className="bg-white rounded" style={{ height: '600px' }}>
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
        <div className="w-80 space-y-6">
          {/* Container Dimensions */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Container Size (points)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Width: {containerWidth}pt
                </label>
                <input
                  type="range"
                  min="50"
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
                  min="50"
                  max="500"
                  value={containerHeight}
                  onChange={(e) => setContainerHeight(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="text-sm text-gray-500">
                Aspect ratio: {(containerWidth / containerHeight).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Presets</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setContainerWidth(300); setContainerHeight(200) }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Landscape
              </button>
              <button
                onClick={() => { setContainerWidth(200); setContainerHeight(300) }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Portrait
              </button>
              <button
                onClick={() => { setContainerWidth(250); setContainerHeight(250) }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Square
              </button>
              <button
                onClick={() => { setContainerWidth(400); setContainerHeight(100) }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Wide
              </button>
            </div>
          </div>

          {/* Fixture Selection */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Source Image</h2>
            <div className="grid grid-cols-2 gap-3">
              {FIXTURES.map((fixture) => (
                <button
                  key={fixture.id}
                  onClick={() => setSelectedFixture(fixture)}
                  className={`relative rounded overflow-hidden border-2 transition-all ${
                    selectedFixture.id === fixture.id
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-transparent hover:border-gray-600'
                  }`}
                >
                  <img
                    src={fixture.path}
                    alt={fixture.label}
                    className="w-full h-24 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-1 text-center">
                    {fixture.width}×{fixture.height}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 text-sm text-gray-400">
              Selected: {selectedFixture.label}
              <br />
              Aspect ratio: {(selectedFixture.width / selectedFixture.height).toFixed(2)}
            </div>
          </div>

          {/* Debug info */}
          <div className="bg-gray-800 rounded-lg p-4 text-xs font-mono text-gray-400">
            <div>Container: {containerWidth}×{containerHeight}</div>
            <div>Source: {selectedFixture.width}×{selectedFixture.height}</div>
            <div>
              Scale needed: {Math.max(
                containerWidth / selectedFixture.width,
                containerHeight / selectedFixture.height
              ).toFixed(3)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
