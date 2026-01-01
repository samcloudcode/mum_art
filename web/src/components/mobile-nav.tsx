'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Layers,
  Image,
  Building2,
  MoreHorizontal,
  TrendingUp,
  PoundSterling,
  History,
  BookOpen,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const mainNavItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Editions', href: '/editions', icon: Layers },
  { name: 'Artworks', href: '/artworks', icon: Image },
  { name: 'Galleries', href: '/galleries', icon: Building2 },
]

const moreNavItems = [
  { name: 'Sales', href: '/sales', icon: PoundSterling },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Change History', href: '/changelog', icon: History },
  { name: 'Guides', href: '/guide', icon: BookOpen },
]

export function MobileNav() {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  const isMoreActive = moreNavItems.some(item => isActive(item.href))

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/50 z-50 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 px-3 rounded-lg transition-colors touch-manipulation',
                  active
                    ? 'text-accent'
                    : 'text-muted-foreground active:bg-secondary/50'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 px-3 rounded-lg transition-colors touch-manipulation',
              isMoreActive
                ? 'text-accent'
                : 'text-muted-foreground active:bg-secondary/50'
            )}
          >
            <MoreHorizontal className={cn('h-5 w-5', isMoreActive && 'stroke-[2.5]')} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-safe rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left font-serif">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            {moreNavItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border transition-colors touch-manipulation',
                    active
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-secondary/30 border-border hover:bg-secondary/50 text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
