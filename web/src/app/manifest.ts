import type { MetadataRoute } from 'next'

// Hex equivalents of the oklch() theme values in globals.css. A manifest takes
// a single colour, so these are the light-theme ones; the dark-mode status bar
// is handled by the themeColor media queries in layout.tsx.
const BACKGROUND = '#faf5ea'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Sue Stitt Art | Collection Manager',
    short_name: 'Collection',
    description: 'Inventory management for fine art print editions',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
