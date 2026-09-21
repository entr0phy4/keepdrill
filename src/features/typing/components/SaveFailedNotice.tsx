import { Button } from '@/components/ui/button'

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
      <Button
        type="button"
        variant="ghost"
        size="icon-compact"
        className="save-failed-dismiss"
        aria-label="Dismiss notice"
        onClick={onDismiss}
      >
        ×
      </Button>
    </p>
  )
}
