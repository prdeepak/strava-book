import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    athleteId?: string
    isAdmin?: boolean
  }
}
