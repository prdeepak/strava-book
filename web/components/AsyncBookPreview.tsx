'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'
import { BookEntry } from '@/lib/curator'

interface BookPreviewProps {
    entries: BookEntry[]
    activities: StravaActivity[]
}

const PDFViewer = dynamic(() => import('@react-pdf/renderer').then(mod => mod.PDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen bg-stone-900 text-stone-400">Assembling your book...</div>
})

// We need a separate component that imports the Document because Document contains styled-components logic
// that might fail if imported directly in server component context or just mixed up. 
// Actually, safely importing the Document component via dynamic is tricky if the props are complex objects.
// Let's create a Client Component that imports BookDocument statically (since it's inside 'use client') 
// and wraps it in PDFViewer.

import { BookDocument } from '@/components/templates/BookDocument'

export default function AsyncBookPreview({ entries, activities }: BookPreviewProps) {
    return (
        <div className="w-full h-screen bg-stone-900">
            <PDFViewer style={{ width: '100%', height: '100%' }}>
                <BookDocument entries={entries} activities={activities} />
            </PDFViewer>
        </div>
    )
}
