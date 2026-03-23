import { getServerSession } from "next-auth"
import Link from "next/link"

export default async function Home() {
  const session = await getServerSession()
  const isMockAuth = process.env.NEXT_PUBLIC_MOCK_AUTH === "true"
  const connectHref = isMockAuth
    ? "/signin"
    : "/api/auth/signin/strava?callbackUrl=/builder"

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      {/* Nav bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-stone-200 bg-stone-50/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-semibold text-stone-800 tracking-tight">Strava Book</span>
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-500">Hey, {session.user?.name}</span>
              <Link
                href="/api/auth/signout"
                className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
              >
                Sign Out
              </Link>
            </div>
          ) : null}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-40 pb-24 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[400px] bg-gradient-radial from-orange-200/60 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600 mb-4">
            For runners, cyclists &amp; adventurers
          </p>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-6 text-stone-900">
            Your Year in Print.
          </h1>
          <p className="text-lg sm:text-xl text-stone-500 max-w-lg mx-auto mb-10 leading-relaxed">
            Transform your Strava activities into a stunning, coffee-table quality book &mdash; every race, ride, and run preserved in print.
          </p>

          {session ? (
            <Link
              href="/builder"
              className="inline-block px-10 py-4 rounded-full bg-orange-600 text-white font-semibold text-lg hover:bg-orange-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              Continue Building
            </Link>
          ) : (
            <Link
              href={connectHref}
              className="inline-block px-10 py-4 rounded-full bg-orange-600 text-white font-semibold text-lg hover:bg-orange-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="group rounded-2xl border border-stone-200 bg-white px-6 py-8 transition-all hover:shadow-md hover:border-stone-300">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center mb-4">1</div>
            <h2 className="text-xl font-semibold mb-2">Sync</h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              Connect your Strava account and instantly import your activities, photos, and stats.
            </p>
          </div>

          <div className="group rounded-2xl border border-stone-200 bg-white px-6 py-8 transition-all hover:shadow-md hover:border-stone-300">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center mb-4">2</div>
            <h2 className="text-xl font-semibold mb-2">Curate</h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              Select your best races, biggest climbs, and most memorable efforts to feature in your book.
            </p>
          </div>

          <div className="group rounded-2xl border border-stone-200 bg-white px-6 py-8 transition-all hover:shadow-md hover:border-stone-300">
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center mb-4">3</div>
            <h2 className="text-xl font-semibold mb-2">Print</h2>
            <p className="text-sm text-stone-500 leading-relaxed">
              Generate a high-resolution PDF ready for professional printing. A real book, not just a screen.
            </p>
          </div>
        </div>
      </section>

      {/* Book Preview Gallery */}
      <section className="bg-stone-100 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-stone-900 mb-3">See what you&apos;ll create</h2>
            <p className="text-stone-500">Every book is unique, built from your personal data and photos.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Sample page: Cover */}
            <div className="group relative">
              <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-stone-800 to-stone-950 shadow-lg overflow-hidden flex flex-col items-center justify-center p-6 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                <div className="w-12 h-0.5 bg-orange-500 mb-4" />
                <div className="text-white/90 text-lg font-semibold text-center mb-1">2025</div>
                <div className="text-white/50 text-xs text-center uppercase tracking-widest">A Year of Running</div>
                <div className="w-12 h-0.5 bg-orange-500 mt-4" />
              </div>
              <p className="text-xs text-stone-500 text-center mt-3 font-medium">Cover Page</p>
            </div>

            {/* Sample page: Monthly Spread */}
            <div className="group relative">
              <div className="aspect-[3/4] rounded-xl bg-white border border-stone-200 shadow-lg overflow-hidden flex flex-col p-5 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                <div className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">March</div>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-2 bg-orange-200 rounded-full w-4/5" />
                  <div className="h-2 bg-orange-300 rounded-full w-3/5" />
                  <div className="h-2 bg-orange-400 rounded-full w-full" />
                  <div className="h-2 bg-orange-200 rounded-full w-2/5" />
                  <div className="h-2 bg-orange-300 rounded-full w-3/4" />
                </div>
                <div className="mt-auto pt-3 border-t border-stone-100 flex justify-between text-[10px] text-stone-400">
                  <span>142 km</span>
                  <span>12 runs</span>
                  <span>1,200 m</span>
                </div>
              </div>
              <p className="text-xs text-stone-500 text-center mt-3 font-medium">Monthly Spread</p>
            </div>

            {/* Sample page: Race Page */}
            <div className="group relative">
              <div className="aspect-[3/4] rounded-xl bg-white border border-stone-200 shadow-lg overflow-hidden flex flex-col transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                <div className="h-2/5 bg-gradient-to-br from-orange-400 to-amber-500 flex items-end p-4">
                  <div className="text-white text-xs font-bold uppercase tracking-wider">Race Day</div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="h-2 bg-stone-200 rounded w-3/4 mb-2" />
                    <div className="h-2 bg-stone-100 rounded w-1/2" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-[10px] text-stone-400">Time</div>
                      <div className="text-xs font-bold text-stone-700">3:42</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-stone-400">Dist</div>
                      <div className="text-xs font-bold text-stone-700">42.2k</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-stone-400">Pace</div>
                      <div className="text-xs font-bold text-stone-700">5:16</div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-stone-500 text-center mt-3 font-medium">Race Page</p>
            </div>

            {/* Sample page: Activity Log */}
            <div className="group relative">
              <div className="aspect-[3/4] rounded-xl bg-white border border-stone-200 shadow-lg overflow-hidden flex flex-col p-5 transition-transform group-hover:-translate-y-1 group-hover:shadow-xl">
                <div className="text-xs font-bold uppercase tracking-widest text-stone-700 mb-3">Activity Log</div>
                <div className="flex-1 flex flex-col gap-2">
                  {[85, 60, 100, 45, 75, 90].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <div className="h-1.5 bg-stone-100 rounded" style={{ width: `${w}%` }} />
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-3 border-t border-stone-100 text-[10px] text-stone-400 text-center">
                  Week 12 Summary
                </div>
              </div>
              <p className="text-xs text-stone-500 text-center mt-3 font-medium">Activity Log</p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900 mb-4">
            Ready to make your book?
          </h2>
          <p className="text-stone-500 mb-8">
            It only takes a few minutes. Connect Strava, pick your activities, and generate your PDF.
          </p>
          {session ? (
            <Link
              href="/builder"
              className="inline-block px-10 py-4 rounded-full bg-orange-600 text-white font-semibold text-lg hover:bg-orange-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              Continue Building
            </Link>
          ) : (
            <Link
              href={connectHref}
              className="inline-block px-10 py-4 rounded-full bg-orange-600 text-white font-semibold text-lg hover:bg-orange-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
            >
              Get Started
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
