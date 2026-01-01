import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { AlertCircle, CheckCircle, Info } from "lucide-react"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "flex items-start gap-3 p-4 rounded-md border text-sm",
  {
    variants: {
      variant: {
        default: "bg-muted/50 border-border text-foreground",
        destructive: "bg-destructive/10 border-destructive/30 text-destructive",
        success: "bg-seafoam/10 border-seafoam/30 text-seafoam",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  default: Info,
  destructive: AlertCircle,
  success: CheckCircle,
}

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: boolean
}

function Alert({
  className,
  variant = "default",
  icon = true,
  children,
  ...props
}: AlertProps) {
  const Icon = iconMap[variant || "default"]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon && <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />}
      <div className="flex-1">{children}</div>
    </div>
  )
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("mt-1 opacity-90", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
