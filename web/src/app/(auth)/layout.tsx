export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-background gallery-texture">
      {/* Left side - decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-muted relative overflow-hidden">
        {/* Abstract art-inspired background */}
        <div className="absolute inset-0">
          {/* Geometric shapes reminiscent of gallery art */}
          <div className="absolute top-20 left-20 w-64 h-64 border border-accent/20 rounded-sm transform rotate-12" />
          <div className="absolute top-40 left-40 w-48 h-48 bg-accent/5 rounded-sm transform -rotate-6" />
          <div className="absolute bottom-32 right-20 w-72 h-72 border border-border rounded-sm" />
          <div className="absolute bottom-20 right-32 w-56 h-56 bg-accent/10 rounded-sm transform rotate-3" />
          <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-foreground/5 rounded-sm" />
        </div>

        {/* Quote overlay */}
        <div className="relative z-10 flex flex-col justify-end p-12">
          <blockquote className="text-xl font-serif text-foreground/80 leading-relaxed max-w-md">
            &ldquo;Every piece tells a story. Every edition is unique.&rdquo;
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">
            Managing fine art collections since 2024
          </p>
        </div>
      </div>

      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  )
}
