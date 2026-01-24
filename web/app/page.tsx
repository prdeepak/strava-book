import { getServerSession } from "next-auth"
import Link from "next/link"

export default async function Home() {
  const session = await getServerSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-stone-50 text-stone-900">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-stone-300 bg-gradient-to-b from-stone-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-stone-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Stava Book Generator
        </p>
      </div>

      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-orange-200 before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-orange-100 after:via-orange-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-orange-700 before:dark:opacity-10 after:dark:from-sky-900 after:dark:via-[#0141ff] after:dark:opacity-40 before:lg:h-[360px]">
        <div className="text-center z-10">
          <h1 className="text-6xl font-bold tracking-tighter mb-4 text-orange-600">Your Year in Print.</h1>
          <p className="text-xl mb-8 text-stone-600 max-w-md mx-auto">
            Turn your Strava data into a beautiful, coffee-table quality book.
          </p>

          {session ? (
            <div className="flex flex-col items-center gap-4">
              <p className="text-lg">Welcome back, {session.user?.name}!</p>
              <div className="flex gap-4">
                <Link
                  href="/api/auth/signout"
                  className="px-6 py-3 rounded-full border border-stone-300 hover:bg-stone-100 transition-colors"
                >
                  Sign Out
                </Link>
                <Link
                  href="/builder"
                  className="px-6 py-3 rounded-full bg-orange-600 text-white font-semibold hover:bg-orange-700 transition-colors shadow-lg"
                >
                  Start Building
                </Link>
              </div>
            </div>
          ) : (
            <Link
              href="/api/auth/signin/strava"
              className="px-8 py-4 rounded-full bg-orange-600 text-white font-semibold text-lg hover:bg-orange-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              Connect with Strava
            </Link>
          )}
        </div>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left mt-24 gap-8">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Sync{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Instant import of your activities, photos, and stats.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Curate{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Select your best races and biggest efforts.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-stone-300 hover:bg-stone-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Print{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Get a high-resolution PDF enabled for professional printing.
          </p>
        </div>
      </div>
    </main>
  )
}
