// The degraded-timing warning is gated on crossOriginIsolated !== true
// (CAPT-05, D-16). It is known at startup and is not dismissible in v1.

interface BannersProps {
  crossOriginIsolated: boolean
}

export function Banners({ crossOriginIsolated }: BannersProps) {
  if (crossOriginIsolated === true) return null

  return (
    <div className="banners grid gap-2">
      <p className="banner banner--warning" role="status">
        <span className="banner-lead">Heads up</span> — High-resolution timing isn&rsquo;t
        available here, so keystroke measurements may be less precise. Open the deployed site over
        a cross-origin-isolated connection for best results.
      </p>
    </div>
  )
}
