// GitHub errors are thrown as named classes and caught at the UI edge, where
// each maps to a fixed copy string rendered inline beneath the offending control
// (RESEARCH "Error-as-typed-class + inline render"). No stack trace, no toast.
// Truncated listings are a result field on RepoTreeResult, not an error class (D-15).

export class InvalidGithubUrlError extends Error {
  constructor() {
    super('Invalid GitHub URL')
    this.name = 'InvalidGithubUrlError'
  }
}

export class RepoNotFoundError extends Error {
  constructor() {
    super('Repository not found')
    this.name = 'RepoNotFoundError'
  }
}

export class EmptyRepoError extends Error {
  readonly owner: string
  readonly repo: string
  readonly defaultBranch: string

  constructor(fields: { owner: string; repo: string; defaultBranch: string }) {
    super(`Repository ${fields.owner}/${fields.repo} is empty`)
    this.name = 'EmptyRepoError'
    this.owner = fields.owner
    this.repo = fields.repo
    this.defaultBranch = fields.defaultBranch
  }
}

export class RateLimitedError extends Error {
  readonly remaining: number
  readonly resetEpochS?: number

  constructor(fields: { remaining: number; resetEpochS?: number }) {
    super('GitHub rate limit exceeded')
    this.name = 'RateLimitedError'
    this.remaining = fields.remaining
    this.resetEpochS = fields.resetEpochS
  }
}

export class GithubHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`GitHub HTTP ${status}`)
    this.name = 'GithubHttpError'
    this.status = status
  }
}
