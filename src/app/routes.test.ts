import { describe, expect, it } from 'vitest'
import { isKnownAppPath, viewFromPathname } from './routes'

describe('viewFromPathname', () => {
  it('maps the three app paths and the /trainer alias', () => {
    expect(viewFromPathname('/')).toBe('trainer')
    expect(viewFromPathname('/trainer')).toBe('trainer')
    expect(viewFromPathname('/history')).toBe('history')
    expect(viewFromPathname('/analytics')).toBe('analytics')
  })

  it('falls back to trainer for unknown paths (redirect target)', () => {
    expect(viewFromPathname('/nope')).toBe('trainer')
    expect(isKnownAppPath('/nope')).toBe(false)
    expect(isKnownAppPath('/')).toBe(true)
    expect(isKnownAppPath('/trainer')).toBe(true)
  })
})
