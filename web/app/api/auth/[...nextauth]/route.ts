import NextAuth from "next-auth"
import StravaProvider from "next-auth/providers/strava"

export const authOptions = {
    providers: [
        StravaProvider({
            clientId: process.env.STRAVA_CLIENT_ID ?? "",
            clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
            authorization: { params: { scope: "activity:read_all,profile:read_all" } },
        }),
    ],
    callbacks: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async jwt({ token, account }: any) {
            if (account) {
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
