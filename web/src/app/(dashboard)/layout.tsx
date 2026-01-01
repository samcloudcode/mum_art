import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { InventoryProvider } from './inventory-provider'
import { MobileNav } from '@/components/mobile-nav'

const navigation = [
  { name: 'Overview', href: '/' },
  { name: 'Editions', href: '/editions' },
  { name: 'Artworks', href: '/artworks' },
  { name: 'Galleries', href: '/galleries' },
  { name: 'Sales', href: '/sales' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Tax Report', href: '/reports/uk-tax-year' },
  { name: 'Change History', href: '/changelog' },
  { name: 'Guides', href: '/guide' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background gallery-texture">
      {/* Refined top navigation */}
      <nav className="bg-card/80 backdrop-blur-sm border-b border-border/50 fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-12">
              {/* Logo/Brand */}
              <Link href="/" className="group flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-accent/10 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </div>
                <span className="font-serif text-lg tracking-tight text-foreground">
                  Sue Stitt Art
                </span>
              </Link>

              {/* Desktop nav */}
              <div className="hidden md:flex items-center gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 relative group"
                  >
                    {item.name}
                    <span className="absolute bottom-0 left-4 right-4 h-px bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user.email}
              </span>
              <form action="/auth/signout" method="post">
                <Button
                  variant="ghost"
                  size="sm"
                  type="submit"
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                >
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Main content area */}
      <main className="pt-16 pb-24 md:pb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <InventoryProvider>
            {children}
          </InventoryProvider>
        </div>
      </main>
    </div>
  )
}
