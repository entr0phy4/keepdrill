import type { FormEvent } from 'react'
import type { FilePlan } from '@/parse/types'
import { Button } from '@/components/ui/button'
import { RepoTreePanel } from './components/RepoSidebarTree'
import { RepoTreeFilterToggle } from './components/RepoTreeFilterToggle'
import {
  RepoBrowserProvider,
  useOptionalRepoBrowserContext,
  useRepoBrowserContext,
} from './RepoBrowserContext'
import { REPO_COPY } from './hooks/use-repo-browser'

function RepoBrowserForm({ showTreeFilter = false }: { showTreeFilter?: boolean }) {
  const {
    url,
    setUrl,
    busy,
    status,
    caption,
    nodes,
    exercisesOnly,
    setExercisesOnly,
    onImport,
  } = useRepoBrowserContext()
  const isError = status?.kind === 'alert'
  const showFilter = showTreeFilter && nodes !== null && nodes.length > 0

  return (
    <section className="grid gap-4">
      <form
        className="grid gap-2"
        aria-busy={busy ? 'true' : 'false'}
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          void onImport()
        }}
      >
        <label htmlFor="github-url" className="text-label">
          {REPO_COPY.urlLabel}
        </label>
        <input
          id="github-url"
          type="text"
          className="control w-full"
          spellCheck={false}
          autoComplete="off"
          placeholder={REPO_COPY.urlPlaceholder}
          value={url}
          aria-invalid={status?.invalidUrl === true ? true : undefined}
          onChange={(e) => setUrl(e.target.value)}
        />
        <div>
          <Button type="submit" variant="primary" disabled={busy} loading={busy}>
            {busy ? REPO_COPY.importBusy : REPO_COPY.importIdle}
          </Button>
        </div>
      </form>

      <div className="repo-caption-row">
        <p className="repo-caption text-muted text-label">{caption}</p>
        {showFilter ? (
          <RepoTreeFilterToggle
            exercisesOnly={exercisesOnly}
            onExercisesOnlyChange={setExercisesOnly}
          />
        ) : null}
      </div>

      <p
        className={isError ? 'repo-status' : 'repo-status text-muted'}
        role={isError ? 'alert' : 'status'}
        style={{
          margin: 0,
          color: isError ? 'var(--destructive)' : undefined,
        }}
      >
        {status?.text ?? ''}
      </p>
    </section>
  )
}

export function RepoBrowser({ onPlanned }: { onPlanned?: (plan: FilePlan) => void } = {}) {
  const ctx = useOptionalRepoBrowserContext()
  if (!ctx) {
    return (
      <RepoBrowserProvider onPlanned={onPlanned}>
        <RepoBrowserForm showTreeFilter />
        <RepoTreePanel />
      </RepoBrowserProvider>
    )
  }
  return <RepoBrowserForm />
}
