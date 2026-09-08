// D-15/D-16/D-17: mirrors Banners.tsx's prop-driven, role="status" convention.
// The one departure from that convention is a dismiss control — the write
// is fire-and-forget (D-04), so there is no retry action. Single generic
// message regardless of failure cause (D-17): no branching on quota vs.
// IndexedDB-unavailable.

export interface SaveFailedNoticeProps {
  onDismiss: () => void
}

export function SaveFailedNotice({ onDismiss }: SaveFailedNoticeProps) {
  return (
    <p className="banner banner--warning save-failed-notice" role="status">
      <span>
        <span className="banner-lead">Heads up</span> — This session couldn&rsquo;t be saved to
        your history.
      </span>
      <button
        type="button"
        className="save-failed-dismiss"
        aria-label="Dismiss notice"
        onClick={onDismiss}
      >
        ×
      </button>
    </p>
  )
}
