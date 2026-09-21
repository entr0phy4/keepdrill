import { Button } from '@/components/ui/button'

export type CorpusTab = 'paste' | 'github'

export interface CorpusSourceTabsProps {
  tab: CorpusTab
  onTabChange: (tab: CorpusTab) => void
}

/**
 * Fluid Button + native tab semantics.
 * @fluid/tabs-subtle unmounts inactive panels; Paste | GitHub must stay mounted
 * (hide via display) so paste text and #github-url survive a tab switch.
 */
export function CorpusSourceTabs({ tab, onTabChange }: CorpusSourceTabsProps) {
  return (
    <div role="tablist" aria-label="Corpus source" className="inline-flex gap-1">
      <Button
        type="button"
        role="tab"
        id="corpus-tab-paste"
        variant="ghost"
        active={tab === 'paste'}
        aria-controls="corpus-panel-paste"
        aria-selected={tab === 'paste' ? 'true' : 'false'}
        onClick={() => onTabChange('paste')}
      >
        Paste
      </Button>
      <Button
        type="button"
        role="tab"
        id="corpus-tab-github"
        variant="ghost"
        active={tab === 'github'}
        aria-controls="corpus-panel-github"
        aria-selected={tab === 'github' ? 'true' : 'false'}
        onClick={() => onTabChange('github')}
      >
        GitHub
      </Button>
    </div>
  )
}
