'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Bot,
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
import { appPath, OPEN_ASSISTANT_EVENT } from '@/lib/app-navigation'

const mainNavItems = [
  { name: 'Home', href: appPath.home, icon: Home },
  { name: 'Assistant', href: appPath.assistant, icon: Bot },
  { name: 'Editions', href: appPath.editions, icon: Layers },
  { name: 'Galleries', href: appPath.galleries, icon: Building2 },
]

const moreNavItems = [
  { name: 'Artworks', href: appPath.artworks, icon: Image },
  { name: 'Sales', href: appPath.sales, icon: PoundSterling },
  { name: 'Analytics', href: appPath.analytics, icon: TrendingUp },
  { name: 'Change History', href: appPath.changelog, icon: History },
  { name: 'Guides', href: appPath.guides, icon: BookOpen },
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
      <nav className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border/50 z-50 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16 px-2">
          {mainNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const className = cn(
              'flex flex-col items-center justify-center gap-1 min-w-[64px] py-2 px-3 rounded-lg transition-colors touch-manipulation',
              active
                ? 'text-accent'
                : 'text-muted-foreground active:bg-secondary/50'
            )
            const content = (
              <>
                <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </>
            )

            if (item.href === appPath.assistant && pathname !== appPath.assistant) {
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
                  className={className}
                >
                  {content}
                </button>
              )
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={className}
              >
                {content}
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
