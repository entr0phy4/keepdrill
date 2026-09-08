import { describe, it, expect } from 'vitest'
import { relativeTime } from './relative-time'

// Golden Case[] table convention (metrics.test.ts / state.test.ts).
interface Case {
  name: string
  diffMs: number
  expected: string
}

const NOW = 1_700_000_000_000

const cases: Case[] = [
  { name: '2 hours ago', diffMs: -2 * 3_600_000, expected: '2 hours ago' },
  { name: '3 days ago', diffMs: -3 * 86_400_000, expected: '3 days ago' },
  { name: '30 seconds ago rounds to just-now class string', diffMs: -30_000, expected: '30 seconds ago' },
  { name: '5 minutes ago', diffMs: -5 * 60_000, expected: '5 minutes ago' },
  { name: '2 months ago', diffMs: -2 * 2_592_000_000, expected: '2 months ago' },
  { name: '1 year ago', diffMs: -1 * 31_536_000_000, expected: 'last year' },
  { name: 'a future timestamp still returns a sane string', diffMs: 2 * 3_600_000, expected: 'in 2 hours' },
]

describe('relativeTime', () => {
  it.each(cases)('$name', ({ diffMs, expected }) => {
    expect(relativeTime(NOW + diffMs, NOW)).toBe(expected)
  })

  it('now (diff 0) is a "just now" / "now"-class string', () => {
    const result = relativeTime(NOW, NOW)
    expect(result).toBe('now')
  })
})
