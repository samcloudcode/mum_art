export const appPath = {
  home: '/',
  assistant: '/assistant',
  editions: '/editions',
  edition: (id: number) => `/editions/${id}`,
  artworks: '/artworks',
  artwork: (id: number) => `/artworks/${id}`,
  galleries: '/galleries',
  gallery: (id: number) => `/galleries/${id}`,
  sales: '/sales',
  analytics: '/analytics',
  taxReport: '/reports/uk-tax-year',
  changelog: '/changelog',
  guides: '/guide',
} as const

export const OPEN_ASSISTANT_EVENT = 'open-inventory-assistant'

const STATIC_APP_PATHS = new Set<string>([
  appPath.home,
  appPath.assistant,
  appPath.editions,
  appPath.artworks,
  appPath.galleries,
  appPath.sales,
  appPath.analytics,
  appPath.taxReport,
  appPath.changelog,
  appPath.guides,
])

export function isAppPath(href: string): boolean {
  const pathname = href.split(/[?#]/, 1)[0]
  return STATIC_APP_PATHS.has(pathname) || /^\/(?:editions|artworks|galleries)\/\d+$/.test(pathname)
}
