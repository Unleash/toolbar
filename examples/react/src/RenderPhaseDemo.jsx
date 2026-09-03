import { useEffect, useMemo, useState } from 'react'
import { useFlag } from '@unleash/proxy-client-react'

/**
 * A page shaped like a real app rather than a minimal one, so that bugs a
 * minimal page cannot surface have somewhere to show up.
 *
 * Two things matter here, and the basic demo has neither:
 *
 *   1. An app-level subscriber to toolbar events that calls setState — the way
 *      an observability or session-recording provider would.
 *   2. Flags first evaluated *later*, when a panel mounts, rather than all up
 *      front on the first render.
 *
 * Together they put a flag's first evaluation inside a render while a
 * subscriber is listening. `useFlag` calls `isEnabled()` during render, so
 * notifying subscribers inline from there lands their setState mid-render, and
 * React rejects it: "Cannot update a component while rendering a different
 * component". Keep the console open while clicking — it should stay quiet.
 */

/**
 * Stands in for the app's own subscriber: a session recorder that wants to tag
 * its timeline whenever flag state changes.
 *
 * It reaches through `window.unleashToolbar.stateManager` because the toolbar
 * exposes no public `subscribe()` today.
 */
function SessionRecorderProvider({ children }) {
  const [events, setEvents] = useState([])

  useEffect(() => {
    let cancelled = false
    let unsubscribe

    // The provider creates the toolbar in its own effect, and child effects run
    // first, so the toolbar may not exist yet on this tick.
    const attach = () => {
      if (cancelled) return
      const stateManager = window.unleashToolbar?.stateManager
      if (!stateManager) {
        setTimeout(attach, 50)
        return
      }
      unsubscribe = stateManager.subscribe((event) => {
        setEvents((current) => [...current, event.type])
      })
    }

    attach()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const summary = useMemo(() => {
    const counts = {}
    for (const type of events) counts[type] = (counts[type] ?? 0) + 1
    return Object.entries(counts)
      .map(([type, count]) => `${type} ×${count}`)
      .join(', ')
  }, [events])

  return (
    <>
      {children}
      <div className="feature-demo">
        <h2>Subscriber: session recorder</h2>
        <p>
          Notifications received: <strong>{events.length}</strong>
          {summary && <> — {summary}</>}
        </p>
      </div>
    </>
  )
}

/** Evaluates one flag during render, as any flag-consuming component does */
function FeatureCard({ flagName }) {
  const enabled = useFlag(flagName)

  return (
    <div className="feature-demo">
      <h2>{flagName}</h2>
      <span className={`status ${enabled ? 'on' : 'off'}`}>{enabled ? 'ENABLED' : 'DISABLED'}</span>
    </div>
  )
}

/**
 * A unique flag name per reveal, so every one is a genuine first sighting.
 *
 * The prefix is per page load: the toolbar persists the flags it has seen, so
 * reusing names across reloads would make every reveal a *known* flag, and the
 * page would stop exercising the first-sighting path.
 */
const loadId = Math.random().toString(36).slice(2, 7)
let flagCounter = 0
const nextFlagName = () => `demo-lazy-flag-${loadId}-${++flagCounter}`

function LazyFeaturePanel() {
  const [revealed, setRevealed] = useState([])

  const reveal = (count) => {
    // Names are generated outside the updater: StrictMode calls updaters twice,
    // and this one would not be pure
    const names = Array.from({ length: count }, nextFlagName)
    setRevealed((current) => [...current, ...names])
  }

  return (
    <>
      <div className="demo-actions">
        <button type="button" onClick={() => reveal(1)}>
          Reveal 1 new flag
        </button>
        <button type="button" onClick={() => reveal(12)}>
          Reveal 12 new flags at once
        </button>
        <button type="button" onClick={() => setRevealed([])}>
          Clear
        </button>
      </div>

      {revealed.map((flagName) => (
        <FeatureCard key={flagName} flagName={flagName} />
      ))}
    </>
  )
}

export function RenderPhaseDemo() {
  return (
    <SessionRecorderProvider>
      <h1>🧪 Lazily evaluated flags</h1>
      <p>
        Revealing a card mounts a component that evaluates a flag the toolbar has
        never seen. That first sighting changes what the toolbar has to show, so
        subscribers are notified — after the render, never during it.
      </p>
      <p>
        Revealing 12 at once produces <strong>one</strong> notification rather
        than twelve, since the deferred emit coalesces per event type. Revealed
        flags stay in the toolbar's list until localStorage is cleared; each page
        load uses a fresh name prefix.
      </p>
      <LazyFeaturePanel />
    </SessionRecorderProvider>
  )
}
