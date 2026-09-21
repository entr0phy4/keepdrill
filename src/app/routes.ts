export const ROUTES = {
  trainer: '/',
  history: '/history',
  analytics: '/analytics',
} as const

export type AppView = 'trainer' | 'history' | 'analytics'

const PATH_TO_VIEW = {
  [ROUTES.trainer]: 'trainer',
  '/trainer': 'trainer',
  [ROUTES.history]: 'history',
  [ROUTES.analytics]: 'analytics',
} as const satisfies Record<string, AppView>

export function viewFromPathname(pathname: string): AppView {
  if (Object.hasOwn(PATH_TO_VIEW, pathname)) {
    return PATH_TO_VIEW[pathname as keyof typeof PATH_TO_VIEW]
  }
  return 'trainer'
}

export function isKnownAppPath(pathname: string): boolean {
  return Object.hasOwn(PATH_TO_VIEW, pathname)
}
