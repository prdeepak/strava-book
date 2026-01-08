import NextAuth from "next-auth"
import StravaProvider from "next-auth/providers/strava"
import CredentialsProvider from "next-auth/providers/credentials"

const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true'

// Build providers list based on environment
const providers = isMockAuth
    ? [
        CredentialsProvider({
            id: 'mock-auth',
            name: 'Mock Auth',
            credentials: {},
            async authorize() {
                // Return mock user for e2e testing
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
    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, account }: any) {
            if (isMockAuth) {
                token.accessToken = 'mock-access-token-for-e2e'
            } else if (account) {
                token.accessToken = account.access_token
            }
            return token
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async session({ session, token }: any) {
            session.accessToken = token.accessToken
            return session
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
