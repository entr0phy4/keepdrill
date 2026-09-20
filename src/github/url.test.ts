import { describe, expect, it } from 'vitest'
import { InvalidGithubUrlError } from './errors'
import { parseGithubRef } from './url'

const OWNER_REPO = { owner: 'owner', repo: 'repo' }

describe('parseGithubRef — D-09 accept golden table', () => {
  it.each([
    ['owner/repo', OWNER_REPO],
    ['https://github.com/owner/repo', OWNER_REPO],
    ['https://www.github.com/owner/repo', OWNER_REPO],
    ['https://github.com/owner/repo.git', OWNER_REPO],
    ['https://github.com/owner/repo/', OWNER_REPO],
    ['https://github.com/owner/repo/blob/main/src/a.ts', OWNER_REPO],
    ['https://github.com/owner/repo/tree/main', OWNER_REPO],
    ['https://github.com/owner/repo/issues/1', OWNER_REPO],
    ['github.com/owner/repo', OWNER_REPO],
  ])('parses %s', (input, expected) => {
    expect(parseGithubRef(input)).toEqual(expected)
  })
})

describe('parseGithubRef — D-10 reject golden table', () => {
  it.each([
    ['https://gist.github.com/u/id'],
    ['https://gitlab.com/o/r'],
    ['https://raw.githubusercontent.com/o/r/main/f.ts'],
    ['https://github.com/owner'],
    ['https://github.com/settings'],
    ['   '],
    [''],
  ])('throws InvalidGithubUrlError for %s', (input) => {
    expect(() => parseGithubRef(input)).toThrow(InvalidGithubUrlError)
  })
})
