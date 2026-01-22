'use client'

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react'
import { StravaActivity } from '@/lib/strava'

export interface PhotoOption {
  url: string
  thumbnailUrl: string
  activityName: string
  activityId: number
  caption?: string
}

interface PhotoSelectorProps {
  photos: PhotoOption[]
  selectedUrl: string | null
  onSelect: (url: string | null) => void
  label: string
  description?: string
}

/**
 * Extract all available photos from activities
 * Returns array of PhotoOption with high-res and thumbnail URLs
 */
export function extractPhotosFromActivities(activities: StravaActivity[]): PhotoOption[] {
  const photos: PhotoOption[] = []

  for (const activity of activities) {
    // Check comprehensive data photos first (highest quality)
    const comprehensivePhotos = activity.comprehensiveData?.photos || []
    for (const photo of comprehensivePhotos) {
      const sizes = Object.keys(photo.urls || {})
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a)

      if (sizes.length > 0) {
        const highResUrl = photo.urls[String(sizes[0])]
        // Use smaller size for thumbnail if available
        const thumbSize = sizes.find(s => s <= 600) || sizes[sizes.length - 1]
        const thumbnailUrl = photo.urls[String(thumbSize)] || highResUrl

        photos.push({
          url: highResUrl,
          thumbnailUrl,
          activityName: activity.name || 'Activity',
          activityId: activity.id,
          caption: photo.caption,
        })
      }
    }

    // Check allPhotos array (from getActivityPhotos API)
    const allPhotos = activity.allPhotos || []
    for (const photo of allPhotos) {
      const sizes = Object.keys(photo.urls || {})
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a)

      if (sizes.length > 0) {
        const highResUrl = photo.urls[String(sizes[0])]
        const thumbSize = sizes.find(s => s <= 600) || sizes[sizes.length - 1]
        const thumbnailUrl = photo.urls[String(thumbSize)] || highResUrl

        // Avoid duplicates
        if (!photos.some(p => p.url === highResUrl)) {
          photos.push({
            url: highResUrl,
            thumbnailUrl,
            activityName: activity.name || 'Activity',
            activityId: activity.id,
            caption: photo.caption,
          })
        }
      }
    }

    // Check primary photo as fallback (only if no comprehensive photos)
    const hasComprehensivePhotos = comprehensivePhotos.length > 0
    if (!hasComprehensivePhotos && activity.photos?.primary?.urls) {
      const primaryUrls = activity.photos.primary.urls as Record<string, string>
      const url600 = primaryUrls['600']
      if (url600 && !photos.some(p => p.url === url600)) {
        photos.push({
          url: url600,
          thumbnailUrl: url600,
          activityName: activity.name || 'Activity',
          activityId: activity.id,
        })
      }
    }
  }

  return photos
}

/**
 * PhotoSelector - Grid of thumbnails for selecting a photo
 * Used for cover, background, and back cover photo selection
 */
export default function PhotoSelector({
  photos,
  selectedUrl,
  onSelect,
  label,
  description,
}: PhotoSelectorProps) {
  const [showAll, setShowAll] = useState(false)
  const displayLimit = 12
  const displayPhotos = showAll ? photos : photos.slice(0, displayLimit)
  const hasMore = photos.length > displayLimit

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-stone-800">{label}</h4>
          {description && (
            <p className="text-xs text-stone-500">{description}</p>
          )}
        </div>
        {selectedUrl && (
          <button
            onClick={() => onSelect(null)}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Clear selection
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="p-4 bg-stone-100 rounded-lg text-center text-stone-500 text-sm">
          No photos available from activities in this date range
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
            {displayPhotos.map((photo, idx) => {
              const isSelected = selectedUrl === photo.url
              return (
                <button
                  key={`${photo.activityId}-${idx}`}
                  onClick={() => onSelect(isSelected ? null : photo.url)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-transparent hover:border-stone-300'
                  }`}
                  title={photo.caption || photo.activityName}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.caption || photo.activityName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showAll ? 'Show less' : `Show all ${photos.length} photos`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
