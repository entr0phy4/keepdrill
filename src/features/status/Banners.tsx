// Both banners are known at startup (App reads crossOriginIsolated + the
// combined timer figure once) and occupy their space from first paint, so
// loading an exercise never shifts the controls above the preview
// (01-UI-SPEC.md). The US-ANSI notice always renders; the degraded-timing
// warning is gated on crossOriginIsolated !== true (CAPT-05, D-16). Neither
// is dismissible in v1. When both show, DOM order (warning first, notice
// second) plus the grid `gap` below produces the spec's "warning above
// notice, --space-sm between" stack.

interface BannersProps {
  crossOriginIsolated: boolean
  timingResolutionUs: number
}

export function Banners({ crossOriginIsolated, timingResolutionUs }: BannersProps) {
  return (
    <div className="banners grid gap-2">
      {crossOriginIsolated !== true && (
        <p className="banner banner--warning" role="status">
          <span className="banner-lead">Heads up</span> — High-resolution timing isn&rsquo;t
          available here, so keystroke measurements may be less precise. Open the deployed site over
          a cross-origin-isolated connection for best results.
        </p>
      )}

      <p className="banner" role="note">
        <span className="banner-lead">Notice</span> — Built and tested for the US ANSI keyboard
        layout. Other layouts may mismatch on symbol keys.
      </p>

      <p className="text-muted" style={{ margin: 0, whiteSpace: 'nowrap' }}>
        Timer resolution: {timingResolutionUs} µs
      </p>
    </div>
  )
}
