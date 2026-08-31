'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Bot,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useInventory } from '@/lib/hooks/use-inventory'
import type {
  ApplyProposalResult,
  AssistantConversationResponse,
  AssistantMessage,
  AssistantProposal,
} from '@/lib/assistant/types'

const CONVERSATION_STORAGE_KEY = 'inventory-assistant-conversation'
const DEFAULT_PHOTO_REQUEST =
  'Read this handwritten inventory note, check each legible entry against the current records, and tell me about discrepancies or possible changes.'

const suggestions = [
  'What inventory changes were made recently?',
  'Help me record some editions I have printed.',
  'I am doing a stock check at a gallery.',
  'How did an edition end up at its current location?',
]

type TurnResponse = {
  conversationId: string
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
  proposal: AssistantProposal | null
}

function apiError(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }
  return fallback
}

const assistantMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="mb-3 leading-6 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 leading-6">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-accent/50 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent underline decoration-accent/40 underline-offset-2 [overflow-wrap:anywhere]"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => (
    <code className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-xs [overflow-wrap:anywhere]', className)}>
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 max-w-full overflow-x-auto rounded-lg border bg-muted p-3 text-xs leading-5">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-r bg-muted px-2 py-2 font-semibold [overflow-wrap:normal] sm:px-3 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-r px-2 py-2 align-top leading-5 [overflow-wrap:normal] sm:px-3 last:border-r-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-4 border-border" />,
}

export function AssistantMessageContent({ content }: { content: string }) {
  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

async function resizeInventoryPhoto(file: File): Promise<File> {
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!supported.includes(file.type)) throw new Error('Use a JPEG, PNG, GIF, or WebP photo')
  if (file.type === 'image/gif' && file.size <= 4 * 1024 * 1024) return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('The photo could not be read'))
      element.src = objectUrl
    })
    const maxDimension = 1_800
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    if (scale === 1 && file.size <= 3.5 * 1024 * 1024) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The photo could not be prepared')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86)
    )
    if (!blob) throw new Error('The photo could not be prepared')
    if (blob.size > 4 * 1024 * 1024) throw new Error('The prepared photo is still too large')
    return new File([blob], 'inventory-note.jpg', { type: 'image/jpeg' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function ProposalCard({
  proposal,
  isApplying,
  onConfirm,
  onDismiss,
}: {
  proposal: AssistantProposal
  isApplying: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const pending = proposal.status === 'pending'
  const statusLabel = proposal.status === 'applied'
    ? 'Applied'
    : proposal.status === 'pending'
      ? 'Awaiting confirmation'
      : proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)

  return (
    <Card className={cn('border-2', pending ? 'border-accent/40' : 'border-border')}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant={proposal.status === 'applied' ? 'default' : 'secondary'}>
              {proposal.status === 'applied' && <Check className="mr-1 h-3 w-3" />}
              {statusLabel}
            </Badge>
            <CardTitle className="mt-2 text-lg">{proposal.preview.summary}</CardTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse proposal' : 'Expand proposal'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {proposal.preview.editions.map((edition) => (
              <div key={edition.editionId} className="rounded-lg border bg-background/70 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{edition.artworkName}</p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {edition.editionLabel}
                  </span>
                </div>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {edition.changes.map((change) => (
                    <div key={change.field} className="grid grid-cols-[7rem_1fr] gap-2">
                      <dt className="text-muted-foreground">{change.label}</dt>
                      <dd className="min-w-0">
                        <span className="text-muted-foreground line-through">{change.before}</span>
                        <span className="px-1.5 text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{change.after}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          {proposal.preview.warnings.map((warning) => (
            <p key={warning} className="text-sm text-amber-700">{warning}</p>
          ))}

          {pending && (
            <>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Expires {new Date(proposal.expiresAt).toLocaleTimeString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={onDismiss} disabled={isApplying}>
                  Dismiss
                </Button>
                <Button type="button" onClick={onConfirm} disabled={isApplying}>
                  {isApplying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Confirm {proposal.preview.editions.length}{' '}
                  {proposal.preview.editions.length === 1 ? 'edition' : 'editions'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function AssistantClient() {
  const { refresh } = useInventory()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [proposal, setProposal] = useState<AssistantProposal | null>(null)
  const [input, setInput] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, proposal, isSending])

  useEffect(() => {
    const savedConversation = window.localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!savedConversation) {
      setIsLoadingHistory(false)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(
          `/api/assistant/messages?conversationId=${encodeURIComponent(savedConversation)}`
        )
        if (!response.ok) {
          window.localStorage.removeItem(CONVERSATION_STORAGE_KEY)
          return
        }
        const data = (await response.json()) as AssistantConversationResponse
        if (cancelled) return
        setConversationId(data.conversationId)
        setMessages(data.messages)
        setProposal(data.proposal)
      } catch {
        if (!cancelled) setError('The previous assistant conversation could not be restored.')
      } finally {
        if (!cancelled) setIsLoadingHistory(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const clearPhoto = useCallback(() => {
    setPhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handlePhoto = useCallback(async (file: File | null) => {
    if (!file) return
    setError(null)
    try {
      const prepared = await resizeInventoryPhoto(file)
      setPhoto(prepared)
      setPhotoPreview(URL.createObjectURL(prepared))
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'The photo could not be prepared')
    }
  }, [])

  const sendMessage = useCallback(async (suggestedText?: string) => {
    const text = (suggestedText ?? input).trim()
    if ((!text && !photo) || isSending) return

    const effectiveText = text || DEFAULT_PHOTO_REQUEST
    const optimistic: AssistantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: photo ? `${effectiveText}\n\n[Inventory photo attached for this turn.]` : effectiveText,
      createdAt: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    setInput('')
    setError(null)
    setIsSending(true)

    const form = new FormData()
    form.set('message', effectiveText)
    if (conversationId) form.set('conversationId', conversationId)
    if (photo) form.set('image', photo)

    try {
      const response = await fetch('/api/assistant/messages', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(apiError(data, 'The assistant could not complete the request'))

      const turn = data as TurnResponse
      setConversationId(turn.conversationId)
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, turn.conversationId)
      setMessages((current) => [...current, turn.assistantMessage])
      setProposal(turn.proposal)
      clearPhoto()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The assistant could not complete the request')
    } finally {
      setIsSending(false)
    }
  }, [clearPhoto, conversationId, input, isSending, photo])

  const confirmProposal = useCallback(async () => {
    if (!proposal || proposal.status !== 'pending') return
    setIsApplying(true)
    setError(null)
    try {
      const response = await fetch(`/api/assistant/proposals/${proposal.id}/confirm`, { method: 'POST' })
      const data = (await response.json()) as ApplyProposalResult & { error?: string }
      if (!response.ok || !data.ok) {
        setProposal((current) => current ? { ...current, status: data.status ?? 'stale' } : current)
        throw new Error(data.message || data.error || 'The proposal could not be applied')
      }
      setProposal((current) => current ? {
        ...current,
        status: 'applied',
        appliedAt: new Date().toISOString(),
        result: data,
      } : current)
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Applied the confirmed proposal to ${data.edition_count ?? proposal.preview.editions.length} ${proposal.preview.editions.length === 1 ? 'edition' : 'editions'}.`,
          createdAt: new Date().toISOString(),
        },
      ])
      await refresh()
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'The proposal could not be applied')
    } finally {
      setIsApplying(false)
    }
  }, [proposal, refresh])

  const dismissProposal = useCallback(async () => {
    if (!proposal || proposal.status !== 'pending') return
    setIsApplying(true)
    setError(null)
    try {
      const response = await fetch(`/api/assistant/proposals/${proposal.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(apiError(data, 'The proposal could not be dismissed'))
      setProposal((current) => current ? { ...current, status: 'rejected' } : current)
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'The proposal could not be dismissed')
    } finally {
      setIsApplying(false)
    }
  }, [proposal])

  const newConversation = useCallback(() => {
    window.localStorage.removeItem(CONVERSATION_STORAGE_KEY)
    setConversationId(null)
    setMessages([])
    setProposal(null)
    setInput('')
    clearPhoto()
    setError(null)
  }, [clearPhoto])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-accent">
            <Bot className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-widest">Proposal agent</span>
          </div>
          <h1>Inventory Assistant</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Ask about stock, recent changes, printing or gallery movements. Nothing changes until
            you review and confirm an exact proposal.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={newConversation}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          New
        </Button>
      </header>

      <div className="min-h-[24rem] space-y-4">
        {isLoadingHistory ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <Bot className="h-7 w-7 text-accent" />
            </div>
            <div>
              <h2 className="text-xl">What would you like to check or update?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You can also photograph a handwritten inventory list.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void sendMessage(suggestion)}
                  className="rounded-xl border bg-card p-4 text-left text-sm transition-colors hover:border-accent/40 hover:bg-accent/5"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'min-w-0 rounded-2xl px-4 py-3 text-sm',
                  message.role === 'user'
                    ? 'max-w-[90%] whitespace-pre-wrap bg-accent text-accent-foreground sm:max-w-[78%]'
                    : 'max-w-[96%] border bg-card text-card-foreground sm:max-w-[85%]'
                )}
              >
                {message.role === 'assistant'
                  ? <AssistantMessageContent content={message.content} />
                  : message.content}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="flex items-center rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking the records…
            </div>
          </div>
        )}

        {proposal && (
          <ProposalCard
            proposal={proposal}
            isApplying={isApplying}
            onConfirm={() => void confirmProposal()}
            onDismiss={() => void dismissProposal()}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="sticky bottom-20 z-10 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        {photoPreview && (
          <div className="mb-3 flex items-start gap-3 rounded-xl border bg-muted/30 p-2">
            <Image
              src={photoPreview}
              alt="Selected inventory note"
              width={96}
              height={72}
              unoptimized
              className="h-16 w-24 rounded-md object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Inventory photo ready</p>
              <p className="text-xs text-muted-foreground">
                Sent for this turn and not stored in the application database.
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={clearPhoto}>
              <X className="h-4 w-4" />
              <span className="sr-only">Remove photo</span>
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            title="Photograph or attach an inventory note"
          >
            {photo ? <ImagePlus className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            <span className="sr-only">Attach inventory photo</span>
          </Button>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Ask about stock or describe a change…"
            rows={2}
            className="min-h-12 max-h-36 resize-none"
            disabled={isSending}
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void sendMessage()}
            disabled={isSending || (!input.trim() && !photo)}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
