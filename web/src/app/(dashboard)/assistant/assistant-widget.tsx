'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { appPath, OPEN_ASSISTANT_EVENT } from '@/lib/app-navigation'
import { AssistantClient } from './assistant-client'

export function AssistantWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openAssistant = () => setOpen(true)
    window.addEventListener(OPEN_ASSISTANT_EVENT, openAssistant)
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, openAssistant)
  }, [])

  if (pathname === appPath.assistant) return null

  return (
    <>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-6 z-40 hidden size-14 rounded-full shadow-xl md:inline-flex"
        onClick={() => setOpen(true)}
        aria-label="Open inventory assistant"
      >
        <Bot className="size-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="!h-[100dvh] !w-full !max-w-none overflow-hidden border-l p-0 sm:!w-[34rem] sm:!max-w-[calc(100vw-1rem)]"
        >
          <SheetTitle className="sr-only">Inventory Assistant</SheetTitle>
          <AssistantClient variant="panel" onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
