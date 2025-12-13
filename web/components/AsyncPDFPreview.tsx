'use client'

import dynamic from 'next/dynamic'
import { StravaActivity } from '@/lib/strava'

// Dynamic import MUST happen inside a client component to use ssr: false
const PDFPreview = dynamic(() => import('@/components/PDFPreview'), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen bg-stone-50 text-stone-500">Generating PDF...</div>
})

export default function AsyncPDFPreview({ activity }: { activity: StravaActivity }) {
    return <PDFPreview activity={activity} />
}
