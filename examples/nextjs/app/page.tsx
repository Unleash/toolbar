'use client';

import { FeatureDemo } from '@/components/FeatureDemo';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900 p-8">
      <main className="flex flex-col items-center gap-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-black dark:text-white">
            Unleash Toolbar + Next.js
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl">
            This demo shows the Unleash Session Override Toolbar integrated with Next.js App Router.
            The toolbar appears at the bottom of the page and allows you to override feature flags in real-time.
          </p>
        </div>
        
        <FeatureDemo />

        <div className="flex gap-4 mt-4">
          <a
            href="/server-demo"
            className="px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          >
            View Server Component Demo →
          </a>
        </div>
      </main>
    </div>
  );
}
