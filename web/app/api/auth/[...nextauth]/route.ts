import NextAuth from "next-auth"
import StravaProvider from "next-auth/providers/strava"
import CredentialsProvider from "next-auth/providers/credentials"
import { isAdminUser } from "@/lib/admin"

const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'

// Mock athlete ID - configurable for demo deployments
const MOCK_ATHLETE_ID = process.env.MOCK_ATHLETE_ID || 'mock-athlete-123'

const DEMO_USERNAME = process.env.DEMO_USERNAME || 'guest'
const DEMO_PASSWORD = process.env.DEMO_PASSWORD

// Build providers list based on environment
const providers = isMockAuth
    ? [
        CredentialsProvider({
            id: 'mock-auth',
            name: 'Mock Auth',
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                // When DEMO_PASSWORD is set, require valid credentials (production demo mode)
                if (DEMO_PASSWORD) {
                    if (
                        credentials?.username === DEMO_USERNAME &&
                        credentials?.password === DEMO_PASSWORD
                    ) {
                        return {
                            id: 'mock-user-123',
                            name: 'Demo User',
                            email: 'demo@strava-book.local',
                        }
                    }
                    return null
                }
                // No DEMO_PASSWORD set — allow any credentials (e2e testing)
                return {
                    id: 'mock-user-123',
                    name: 'Test Runner',
                    email: 'test@strava-book.local',
                }
            },
        }),
    ]
    : [
        StravaProvider({
            clientId: process.env.STRAVA_CLIENT_ID ?? "",
            clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
            authorization: { params: { scope: "activity:read_all,profile:read_all" } },
        }),
    ]

export const authOptions = {
    providers,
    pages: {
        signIn: '/signin',
    },
    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, account, profile }: any) {
            if (isMockAuth) {
                token.accessToken = 'mock-access-token-for-e2e'
                token.athleteId = MOCK_ATHLETE_ID
            } else if (account) {
                token.accessToken = account.access_token
                // Strava provides athlete ID in providerAccountId and profile.id
                token.athleteId = account.providerAccountId || profile?.id?.toString()
            }
            return token
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async session({ session, token }: any) {
            session.accessToken = token.accessToken
            session.athleteId = token.athleteId
            session.isAdmin = isAdminUser(token.athleteId)
            return session
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
