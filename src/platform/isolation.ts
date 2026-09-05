// Platform seam — runtime environment probes (D-16). Kept out of the hot path.

/** One boolean read; the browser already computed it (D-15/D-16). */
export function readCrossOriginIsolated(): boolean {
  return typeof self !== 'undefined' && self.crossOriginIsolated === true
}

// Wired by Plan 01-03: capture.ts feeds real inter-keystroke deltas (measured
// smallest non-zero event.timeStamp gap) via a microtask tap on each real
// keydown. Until enough keystrokes exist, the probe reports the per-browser
// EXPECTED resolution keyed on cross-origin isolation (assumption A10) — a
// tight perf-counter loop would measure call overhead, not stamp granularity.
let measuredResolutionUs: number | null = null

/** Documented hook for Plan 01-03: feed it observed inter-sample deltas (µs). */
export function recordMeasuredResolutionUs(deltaUs: number): void {
  if (!Number.isFinite(deltaUs) || deltaUs <= 0) return
  measuredResolutionUs =
    measuredResolutionUs === null ? deltaUs : Math.min(measuredResolutionUs, deltaUs)
}

function expectedResolutionUs(): number {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isFirefox = /firefox/i.test(ua)
  if (isFirefox) return 1000 // Firefox clamps to ~1ms regardless of isolation
  // Chromium family: ~5µs cross-origin-isolated, ~100µs otherwise.
  return readCrossOriginIsolated() ? 5 : 100
}

/** The figure stored on Session.timingResolutionUs (D-16). Prefers a real
 *  measurement once Plan 01-03 supplies one, else the per-browser expectation. */
export function probeTimerResolutionUs(): number {
  return measuredResolutionUs ?? expectedResolutionUs()
}

/** The full combined figure (planner_assumption on CAPT-05, A10): the
 *  per-browser expected resolution keyed on crossOriginIsolated, plus the
 *  measured smallest non-zero event.timeStamp delta once enough real
 *  keystrokes exist (null until then). */
export function getTimingResolutionUs(): { expectedUs: number; measuredUs: number | null } {
  return { expectedUs: expectedResolutionUs(), measuredUs: measuredResolutionUs }
}
