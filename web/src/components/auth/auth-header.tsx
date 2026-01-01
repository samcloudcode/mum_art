import { cn } from "@/lib/utils"

interface AuthHeaderProps {
  icon: "gallery" | "lock" | "email"
  title: string
  description: string
  className?: string
}

const icons = {
  gallery: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  ),
  lock: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
    />
  ),
  email: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
    />
  ),
}

export function AuthHeader({ icon, title, description, className }: AuthHeaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-sm bg-accent/10 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            {icons[icon]}
          </svg>
        </div>
        <span className="font-serif text-xl tracking-tight text-foreground">
          Sue Stitt Art
        </span>
      </div>
      <h1 className="text-foreground">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

export function AuthFooter() {
  return (
    <p className="text-center text-sm text-muted-foreground/60">
      Sue Stitt Art &middot; Collection Manager
    </p>
  )
}
