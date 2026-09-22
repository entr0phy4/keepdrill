import type { FormEvent } from 'react'
import type { FilePlan } from '@/parse/types'
import { Button } from '@/components/ui/button'
import { RepoTree } from './components/RepoTree'
import { REPO_COPY, useRepoBrowser } from './hooks/use-repo-browser'

export function RepoBrowser({ onPlanned }: { onPlanned?: (plan: FilePlan) => void } = {}) {
  const { url, setUrl, busy, status, caption, nodes, selectedPath, onFileClick, onImport } =
    useRepoBrowser(onPlanned)
  const showTree = nodes !== null && nodes.length > 0
  const isError = status?.kind === 'alert'

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

      <p className="repo-caption text-muted text-label">{caption}</p>

      {showTree && nodes !== null && (
        <RepoTree
          nodes={nodes}
          selectedPath={selectedPath}
          onFileClick={(node) => void onFileClick(node)}
        />
      )}

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
