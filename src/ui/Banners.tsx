// Banner shells (01-UI-SPEC.md). Behavior polish — dismissal, fade timing,
// no-layout-shift stacking — is Plan 01-03. Both banners reserve their space
// from first paint.

interface BannersProps {
  crossOriginIsolated: boolean
  timingResolutionUs: number
}

export function Banners({ crossOriginIsolated, timingResolutionUs }: BannersProps) {
  return (
    <div className="banners" style={{ display: 'grid', gap: 'var(--space-sm)' }}>
      {!crossOriginIsolated && (
        <p className="banner banner--warning" role="status">
          <span className="banner-lead">Heads up</span> — High-resolution timing
          isn&rsquo;t available here, so keystroke measurements may be less precise.
          Open the deployed site over a cross-origin-isolated connection for best
          results.
        </p>
      )}

      <p className="banner" role="note">
        <span className="banner-lead">Notice</span> — Built and tested for the US
        ANSI keyboard layout. Other layouts may mismatch on symbol keys.
      </p>

      <p className="text-muted" style={{ margin: 0, whiteSpace: 'nowrap' }}>
        Timer resolution: {timingResolutionUs} µs
      </p>
    </div>
  )
}
