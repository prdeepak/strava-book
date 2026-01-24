'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function SignInContent() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/builder'

    useEffect(() => {
        // Immediately trigger Strava OAuth
        signIn('strava', { callbackUrl })
    }, [callbackUrl])

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-stone-50 text-stone-900">
            <div className="text-center">
                <div className="animate-pulse">
                    <p className="text-lg text-stone-600">Redirecting to Strava...</p>
                </div>
            </div>
        </main>
    )
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-stone-50 text-stone-900">
                <div className="text-center">
                    <p className="text-lg text-stone-600">Loading...</p>
                </div>
            </main>
        }>
            <SignInContent />
        </Suspense>
    )
}
