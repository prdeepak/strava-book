'use client'

import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'

function MockSignInForm() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/builder'
    const errorParam = searchParams.get('error')

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(errorParam ? 'Invalid username or password' : '')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const result = await signIn('mock-auth', {
            username,
            password,
            callbackUrl,
            redirect: false,
        })

        if (result?.error) {
            setError('Invalid username or password')
            setLoading(false)
        } else if (result?.url) {
            window.location.href = result.url
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-stone-50 text-stone-900">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 mb-2">
                        Strava Book
                    </h1>
                    <p className="text-stone-500">
                        Sign in to explore the demo
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-stone-700 mb-1">
                            Username
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors"
                            placeholder="Username"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-stone-900 placeholder-stone-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-colors"
                            placeholder="Password"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-orange-600 px-4 py-2.5 font-semibold text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </main>
    )
}

function StravaSignIn() {
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/builder'

    useEffect(() => {
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

function SignInContent() {
    if (isMockAuth) {
        return <MockSignInForm />
    }
    return <StravaSignIn />
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
