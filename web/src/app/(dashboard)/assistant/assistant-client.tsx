'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowRightLeft,
  Bot,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  History,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Mic,
  PoundSterling,
  Printer,
  RotateCcw,
  Send,
  ShieldCheck,
  Square,
  X,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SheetClose } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useInventory } from '@/lib/hooks/use-inventory'
import type {
  ApplyProposalResult,
  AssistantConversationResponse,
  AssistantConversationSummary,
  AssistantMessage,
  AssistantProposal,
} from '@/lib/assistant/types'
import { appPath, isAppPath } from '@/lib/app-navigation'
import { transcriptionFileName } from '@/lib/assistant/transcription'
import {
  ASSISTANT_PROGRESS_TEXT,
  readAssistantStream,
  type AssistantProgress,
} from '@/lib/assistant/assistant-stream'

const CONVERSATION_STORAGE_KEY = 'inventory-assistant-conversation'
const DEFAULT_PHOTO_REQUEST =
  'Read this handwritten inventory note, check each legible entry against the current records, and tell me about discrepancies or possible changes.'

export const ASSISTANT_SUGGESTIONS = [
  {
    title: 'Confirmed stock',
    description: 'List confirmed stock at Kendals including sizes',
    template: 'List confirmed stock at Kendals including sizes',
    icon: ClipboardCheck,
  },
  {
    title: 'Review unconfirmed stock',
    description:
      'Review unconfirmed stock at Kendalls, oldest records first, so I can decide what to confirm or move to Unknown.',
    template:
      'Review unconfirmed stock at Kendalls, oldest records first, so I can decide what to confirm or move to Unknown.',
    icon: Clock3,
  },
  {
    title: 'Find artwork stock',
    description:
      'Where is my printed, unsold stock of Bembridge Lifeboat Station Landscape, split into confirmed and unconfirmed, with sizes and frames.',
    template:
      'Where is my printed, unsold stock of Bembridge Lifeboat Station Landscape, split into confirmed and unconfirmed, with sizes and frames.',
    icon: ClipboardCheck,
  },
  {
    title: 'Compare sales',
    description:
      'What were my best-selling prints year to date versus the same period last year, taking current availability and seasonality into account?',
    template:
      'What were my best-selling prints year to date versus the same period last year, taking current availability and seasonality into account?',
    icon: Clock3,
  },
  {
    title: 'Record printing',
    description: 'I’ve just printed Seagrove Landscape editions 112, 113 and 114. They’re all large and framed.',
    template: 'I’ve just printed Seagrove Landscape editions 112, 113 and 114. They’re all large and framed.',
    icon: Printer,
  },
  {
    title: 'Move stock',
    description: 'I’ve moved Osborne edition 159 from Kendalls to Seaview Gallery.',
    template: 'I’ve moved Osborne edition 159 from Kendalls to Seaview Gallery.',
    icon: ArrowRightLeft,
  },
  {
    title: 'Record a sale',
    description: 'Bembridge Lifeboat Station Landscape edition 18 sold for £235 today.',
    template: 'Bembridge Lifeboat Station Landscape edition 18 sold for £235 today.',
    icon: PoundSterling,
  },
]

function apiError(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'error' in value && typeof value.error === 'string') {
    return value.error
  }
  return fallback
}

async function responseData(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

type AudioState = 'idle' | 'requesting' | 'recording' | 'transcribing'

const RECORDING_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
const MAX_RECORDING_MS = 60_000

export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException
    ? error.name
    : error && typeof error === 'object' && 'name' in error && typeof error.name === 'string'
      ? error.name
      : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it in your browser settings, then try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found. Check your device microphone and try again.'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'Your microphone is unavailable. Close any other app using it, then try again.'
    default:
      return 'I could not start the microphone. Please try again or type your request.'
  }
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

export function AssistantMessageContent({
  content,
  onNavigate,
}: {
  content: string
  onNavigate?: () => void
}) {
  const components: Components = {
    ...assistantMarkdownComponents,
    a: ({ children, href }) => {
      const className =
        'text-accent underline decoration-accent/40 underline-offset-2 [overflow-wrap:anywhere]'
      if (href && isAppPath(href)) {
        return <Link href={href} className={className} onClick={onNavigate}>{children}</Link>
      }
      if (href?.startsWith('/')) return <span>{children}</span>
      return (
        <a href={href} target="_blank" rel="noreferrer" className={className}>
          {children}
        </a>
      )
    },
  }

  return (
    <div className="min-w-0 [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function AssistantProgressStatus({
  progress,
}: {
  progress: AssistantProgress | null
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Assistant
      </span>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex min-h-[4.25rem] w-full max-w-md items-center rounded-2xl border bg-card px-4 py-3 text-[15px] text-muted-foreground sm:min-h-12 sm:text-sm"
      >
        <Loader2
          aria-hidden="true"
          className="mr-2 h-3.5 w-3.5 shrink-0 animate-spin motion-reduce:animate-none"
        />
        <span>{progress ? ASSISTANT_PROGRESS_TEXT[progress] : 'Sending your request…'}</span>
      </div>
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
  onUndo,
  onNavigate,
}: {
  proposal: AssistantProposal
  isApplying: boolean
  onConfirm: () => void
  onDismiss: () => void
  onUndo?: () => void
  onNavigate?: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const pending = proposal.status === 'pending'
  const statusLabel = proposal.status === 'applied'
    ? 'Applied'
    : proposal.status === 'pending'
      ? 'Awaiting confirmation'
      : proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)

  return (
    <Card className={cn('min-w-0 gap-5 overflow-hidden border-2 py-5 sm:gap-6 sm:py-6', pending ? 'border-accent/40' : 'border-border')}>
      <CardHeader className="px-4 pb-2 sm:px-6 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant={proposal.status === 'applied' ? 'default' : 'secondary'}>
              {proposal.status === 'applied' && <Check className="mr-1 h-3 w-3" />}
              {statusLabel}
            </Badge>
            <CardTitle className="mt-2 [overflow-wrap:anywhere] text-lg leading-snug">
              {proposal.preview.summary}
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? 'Collapse proposal' : 'Expand proposal'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div className="mobile-scroll max-h-[45dvh] space-y-3 overflow-y-auto pr-1">
            {proposal.preview.editions.map((edition) => (
              <div key={edition.editionId} className="rounded-lg border bg-background/70 p-3">
                <Link
                  href={appPath.edition(edition.editionId)}
                  onClick={onNavigate}
                  className="inline-touch flex flex-wrap items-baseline justify-between gap-2 text-accent underline decoration-accent/40 underline-offset-2"
                >
                  <span className="font-medium">{edition.artworkName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {edition.editionLabel}
                  </span>
                </Link>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {edition.changes.map((change) => (
                    <div
                      key={change.field}
                      className="grid min-w-0 grid-cols-1 gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-2"
                    >
                      <dt className="text-muted-foreground">{change.label}</dt>
                      <dd className="min-w-0 [overflow-wrap:anywhere]">
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
              <div className="space-y-2 rounded-lg bg-accent/5 p-3 text-sm">
                <p className="flex items-start gap-2 font-medium">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  Review these changes before confirming. Nothing has changed yet.
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Expires {new Date(proposal.expiresAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={onDismiss}
                  disabled={isApplying}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={onConfirm}
                  disabled={isApplying}
                >
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

          {proposal.status === 'applied' && proposal.undoable && onUndo && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={onUndo}
                disabled={isApplying}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Undo this change
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export function ConversationHistory({
  conversations,
  currentId,
  isLoading,
  error,
  onSelect,
}: {
  conversations: AssistantConversationSummary[]
  currentId: string | null
  isLoading: boolean
  error?: string | null
  onSelect: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading conversations…
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="mt-0">{error}</AlertDescription>
      </Alert>
    )
  }

  if (conversations.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No previous conversations yet.</p>
  }

  return (
    <div className="space-y-2">
      <p className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recent conversations
      </p>
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          type="button"
          className={cn(
            'w-full rounded-xl border p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5',
            conversation.id === currentId && 'border-accent/40 bg-accent/5'
          )}
          onClick={() => onSelect(conversation.id)}
        >
          <span className="block truncate text-sm font-medium">{conversation.title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {new Date(conversation.updatedAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </button>
      ))}
    </div>
  )
}

export function AssistantClient({
  variant = 'page',
  onNavigate,
}: {
  variant?: 'page' | 'panel'
  onNavigate?: () => void
}) {
  const panel = variant === 'panel'
  const { refresh } = useInventory()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([])
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [proposal, setProposal] = useState<AssistantProposal | null>(null)
  const [input, setInput] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [progress, setProgress] = useState<AssistantProgress | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [conversationListError, setConversationListError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingTimeoutRef = useRef<number | null>(null)
  const transcriptionAbortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const releaseMicrophone = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
  }, [])

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true)
    setConversationListError(null)
    try {
      const response = await fetch('/api/assistant/conversations')
      const data = await responseData(response)
      if (!response.ok) throw new Error(apiError(data, 'Could not load conversations'))
      setConversations((data as { conversations: AssistantConversationSummary[] }).conversations)
    } catch (historyError) {
      setConversationListError(
        historyError instanceof Error ? historyError.message : 'Could not load conversations'
      )
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingHistory(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/assistant/messages?conversationId=${encodeURIComponent(id)}`
      )
      const data = await responseData(response)
      if (!response.ok) throw new Error(apiError(data, 'Could not load this conversation'))
      const conversation = data as AssistantConversationResponse
      setConversationId(conversation.conversationId)
      setMessages(conversation.messages)
      setProposal(conversation.proposal)
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, conversation.conversationId)
      setShowHistory(false)
    } catch (historyError) {
      if (window.localStorage.getItem(CONVERSATION_STORAGE_KEY) === id) {
        window.localStorage.removeItem(CONVERSATION_STORAGE_KEY)
      }
      setError(historyError instanceof Error ? historyError.message : 'Could not load this conversation')
      setShowHistory(false)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [error, messages, proposal, isSending])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const borderHeight = textarea.offsetHeight - textarea.clientHeight
    const contentHeight = textarea.scrollHeight + borderHeight
    textarea.style.height = `${Math.max(52, Math.min(contentHeight, 192))}px`
    textarea.style.overflowY = contentHeight > 192 ? 'auto' : 'hidden'
    if (contentHeight > 192) {
      const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight)
      if (Number.isFinite(lineHeight) && lineHeight > 0) {
        textarea.scrollTop = Math.round(textarea.scrollTop / lineHeight) * lineHeight
      }
    }
  }, [input])

  useEffect(() => {
    const savedConversation = window.localStorage.getItem(CONVERSATION_STORAGE_KEY)
    if (!savedConversation) {
      setIsLoadingHistory(false)
    } else {
      void loadConversation(savedConversation)
    }
    void loadConversations()
  }, [loadConversation, loadConversations])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      transcriptionAbortRef.current?.abort()
      const recorder = mediaRecorderRef.current
      if (recorder) {
        recorder.onstop = null
        recorder.onerror = null
        if (recorder.state !== 'inactive') recorder.stop()
      }
      releaseMicrophone()
    }
  }, [releaseMicrophone])

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

  const prepareTask = useCallback((template: string) => {
    setInput(template)
    setError(null)
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      const selectionStart = template.indexOf('[')
      const selectionEnd = template.indexOf(']', selectionStart) + 1
      if (selectionStart >= 0 && selectionEnd > selectionStart) {
        textarea.setSelectionRange(selectionStart, selectionEnd)
      }
    })
  }, [])

  const transcribeRecording = useCallback(async (
    recording: Blob,
    mimeType: string,
    existingInput: string
  ) => {
    const controller = new AbortController()
    transcriptionAbortRef.current = controller
    setAudioState('transcribing')

    try {
      const form = new FormData()
      form.set('audio', recording, transcriptionFileName(mimeType))
      const response = await fetch('/api/assistant/transcribe', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      })
      const data = await responseData(response)
      if (!response.ok) throw new Error(apiError(data, 'Voice transcription failed. Please try again.'))
      const transcript = data && typeof data === 'object' && 'transcript' in data
        && typeof data.transcript === 'string'
        ? data.transcript.trim()
        : ''
      if (!transcript) throw new Error('I could not hear any speech in that recording. Please try again.')

      setInput([existingInput, transcript].filter(Boolean).join(' '))
      setSpeechError(null)
      window.requestAnimationFrame(() => textareaRef.current?.focus())
    } catch (transcriptionError) {
      if (controller.signal.aborted) return
      setSpeechError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : 'Voice transcription failed. Please try again or type your request.'
      )
    } finally {
      if (transcriptionAbortRef.current === controller) transcriptionAbortRef.current = null
      if (!controller.signal.aborted) setAudioState('idle')
    }
  }, [])

  const toggleRecording = useCallback(async () => {
    if (audioState === 'recording') {
      const recorder = mediaRecorderRef.current
      if (recorder?.state === 'recording') recorder.stop()
      return
    }
    if (audioState !== 'idle') return

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setSpeechError('Voice recording is not supported by this browser. You can still type your request.')
      return
    }
    const mimeType = RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setSpeechError('This browser cannot make a supported audio recording. You can still type your request.')
      return
    }

    setSpeechError(null)
    setAudioState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []
      const existingInput = input.trim()
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onerror = () => {
        recorder.onstop = null
        releaseMicrophone()
        setAudioState('idle')
        setSpeechError('The recording stopped unexpectedly. Please try again or type your request.')
      }
      recorder.onstop = () => {
        const recordingType = recorder.mimeType || mimeType
        const recording = new Blob(chunks, { type: recordingType })
        releaseMicrophone()
        if (recording.size === 0) {
          setAudioState('idle')
          setSpeechError('No audio was captured. Please try again.')
          return
        }
        void transcribeRecording(recording, recordingType, existingInput)
      }

      recorder.start(1_000)
      setAudioState('recording')
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, MAX_RECORDING_MS)
    } catch (recordingError) {
      releaseMicrophone()
      if (!mountedRef.current) return
      setAudioState('idle')
      setSpeechError(microphoneErrorMessage(recordingError))
    }
  }, [audioState, input, releaseMicrophone, transcribeRecording])

  const sendMessage = useCallback(async (suggestedText?: string) => {
    const text = (suggestedText ?? input).trim()
    if ((!text && !photo) || isSending || audioState !== 'idle') return

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
    setProgress(null)
    setIsSending(true)

    const form = new FormData()
    form.set('message', effectiveText)
    if (conversationId) form.set('conversationId', conversationId)
    if (photo) form.set('image', photo)

    try {
      const response = await fetch('/api/assistant/messages', { method: 'POST', body: form })
      if (!response.ok) {
        const data = await responseData(response)
        throw new Error(apiError(data, 'The assistant could not complete the request'))
      }
      if (!response.headers.get('content-type')?.includes('application/x-ndjson')) {
        throw new Error('The assistant response could not be read. No inventory was changed. Please try again.')
      }

      const turn = await readAssistantStream(response.body, setProgress)
      setConversationId(turn.conversationId)
      window.localStorage.setItem(CONVERSATION_STORAGE_KEY, turn.conversationId)
      setMessages((current) => [...current, turn.assistantMessage])
      setProposal(turn.proposal)
      clearPhoto()
      void loadConversations()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The assistant could not complete the request')
    } finally {
      setProgress(null)
      setIsSending(false)
    }
  }, [audioState, clearPhoto, conversationId, input, isSending, loadConversations, photo])

  const confirmProposal = useCallback(async () => {
    if (!proposal || proposal.status !== 'pending') return
    setIsApplying(true)
    setError(null)
    try {
      const response = await fetch(`/api/assistant/proposals/${proposal.id}/confirm`, { method: 'POST' })
      const data = (await responseData(response)) as (ApplyProposalResult & { error?: string }) | null
      if (!data) throw new Error('The proposal response could not be read. No inventory was changed.')
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
      const data = await responseData(response)
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
    setProgress(null)
    setShowHistory(false)
    clearPhoto()
    setError(null)
  }, [clearPhoto])

  return (
    <div
      className={cn(
        'assistant-page flex w-full min-w-0 flex-col overflow-hidden bg-background',
        panel ? '!h-[100dvh]' : 'mx-auto -mt-4 max-w-4xl md:mt-0'
      )}
    >
      <header
        className={cn(
          'shrink-0 border-b border-border',
          panel ? 'px-4 py-3' : 'pb-4 sm:pb-6'
        )}
      >
        <div
          className={cn(
            'min-w-0',
            panel ? 'space-y-3' : 'flex items-center justify-between gap-3'
          )}
        >
          <div className={cn('min-w-0', panel && 'flex items-center justify-between gap-3')}>
            <div className="min-w-0">
              <div className={cn('flex items-center gap-2 text-accent', !panel && 'mb-1.5')}>
                <Bot className="h-5 w-5 shrink-0" />
                {panel ? (
                  <h1 className="truncate text-lg text-foreground">Inventory Assistant</h1>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-widest">Safe inventory updates</span>
                )}
              </div>
              {!panel && (
                <h1 className="text-[1.75rem] sm:text-4xl md:text-[2.5rem]">Inventory Assistant</h1>
              )}
            </div>
            {panel && (
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11 shrink-0 px-3"
                  aria-label="Close inventory assistant"
                >
                  <X className="size-4" />
                  <span>Close</span>
                </Button>
              </SheetClose>
            )}
          </div>
          <div className={cn('flex shrink-0 items-center gap-1.5', panel && '[&>*]:flex-1')}>
            <Button
              type="button"
              variant={showHistory ? 'secondary' : 'outline'}
              size="sm"
              className="h-11 px-2.5 sm:px-3"
              onClick={() => setShowHistory((current) => !current)}
              disabled={isSending || audioState !== 'idle'}
              aria-label="Show previous conversations"
            >
              <History className="size-4" />
              <span>History</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-2.5 sm:px-3"
              onClick={newConversation}
              disabled={isSending || audioState !== 'idle'}
              aria-label="Start a new conversation"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>New</span>
            </Button>
          </div>
        </div>
        {!panel && (
          <p className="mt-2 max-w-2xl text-sm leading-5 text-muted-foreground sm:text-base sm:leading-6">
            Ask about stock or describe a change. You review an exact proposal before anything is
            updated.
          </p>
        )}
      </header>

      <div
        className={cn(
          'mobile-scroll min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto',
          panel ? 'px-4 py-4' : 'py-4 pr-1'
        )}
      >
        {showHistory ? (
          <ConversationHistory
            conversations={conversations}
            currentId={conversationId}
            isLoading={isLoadingConversations}
            error={conversationListError}
            onSelect={(id) => void loadConversation(id)}
          />
        ) : isLoadingHistory ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading conversation…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-center space-y-3 text-center sm:space-y-6 sm:py-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 sm:h-14 sm:w-14">
              <Bot className="h-6 w-6 text-accent sm:h-7 sm:w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl">What would you like to do?</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Choose a task, type your own request, or attach a handwritten list.
              </p>
            </div>
            <div
              className={cn(
                'grid grid-cols-1 gap-2 text-left',
                !panel && 'sm:grid-cols-2'
              )}
            >
              {ASSISTANT_SUGGESTIONS.map((suggestion) => {
                const Icon = suggestion.icon
                return (
                  <button
                    key={suggestion.template}
                    type="button"
                    onClick={() => prepareTask(suggestion.template)}
                    className="flex min-w-0 gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 sm:p-4"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent sm:h-5 sm:w-5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{suggestion.title}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
                        {suggestion.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex min-w-0 flex-col gap-1',
                message.role === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <span className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <div
                className={cn(
                  'min-w-0 rounded-2xl px-4 py-3 text-[15px] sm:text-sm',
                  message.role === 'user'
                    ? 'max-w-[90%] whitespace-pre-wrap bg-accent text-accent-foreground sm:max-w-[78%] [overflow-wrap:anywhere]'
                    : 'w-full border bg-card text-card-foreground sm:w-auto sm:max-w-[88%]'
                )}
              >
                {message.role === 'assistant'
                  ? <AssistantMessageContent content={message.content} onNavigate={onNavigate} />
                  : message.content}
              </div>
            </div>
          ))
        )}

        {!showHistory && isSending && (
          <AssistantProgressStatus progress={progress} />
        )}

        {!showHistory && proposal && (
          <ProposalCard
            proposal={proposal}
            isApplying={isApplying}
            onConfirm={() => void confirmProposal()}
            onDismiss={() => void dismissProposal()}
            onNavigate={onNavigate}
            onUndo={() => void sendMessage(
              'Undo the most recent applied change in this conversation. Prepare an exact reversal proposal for me to review before anything changes.'
            )}
          />
        )}

        {!showHistory && error && (
          <Alert variant="destructive">
            <AlertDescription className="mt-0">{error}</AlertDescription>
          </Alert>
        )}
        <div ref={bottomRef} />
      </div>

      {!showHistory && <div
        className={cn(
          'assistant-composer z-10 min-w-0 shrink-0 border-t bg-background/95 p-3 backdrop-blur',
          panel ? 'pb-safe' : 'rounded-2xl border shadow-lg'
        )}
      >
        {photoPreview && (
          <div className="mb-3 flex min-w-0 items-start gap-3 rounded-xl border bg-muted/30 p-2">
            <Image
              src={photoPreview}
              alt="Selected inventory note"
              width={80}
              height={64}
              unoptimized
              className="h-16 w-20 shrink-0 rounded-md object-cover sm:w-24"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Inventory photo ready</p>
              <p className="text-xs leading-4 text-muted-foreground">
                Used for this message only and not stored in the app.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={clearPhoto}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove photo</span>
            </Button>
          </div>
        )}

        <div className="min-w-0 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)}
          />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder="Ask about stock or describe a change…"
            aria-label="Message the inventory assistant"
            enterKeyHint="send"
            rows={1}
            className="box-border h-[52px] min-h-[52px] w-full resize-none overflow-y-hidden py-3 text-base leading-6 [scroll-padding-block:0.75rem] md:text-sm"
            disabled={isSending || audioState !== 'idle'}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || audioState !== 'idle'}
                title="Photograph or attach an inventory note"
              >
                {photo ? <ImagePlus className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                <span className="sr-only">Attach inventory photo</span>
              </Button>
              <Button
                type="button"
                variant={audioState === 'recording' ? 'default' : 'outline'}
                size="icon"
                className="size-12 shrink-0"
                onClick={() => void toggleRecording()}
                disabled={isSending || audioState === 'requesting' || audioState === 'transcribing'}
                aria-pressed={audioState === 'recording'}
                title={audioState === 'recording' ? 'Stop voice recording' : 'Dictate a request'}
              >
                {audioState === 'recording' ? (
                  <Square className="size-4 fill-current" />
                ) : audioState === 'requesting' || audioState === 'transcribing' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mic className="size-4" />
                )}
                <span className="sr-only">
                  {audioState === 'recording' ? 'Stop dictation' : 'Dictate a request'}
                </span>
              </Button>
              {audioState !== 'idle' && (
                <span className="text-xs font-medium text-accent sm:text-sm" role="status">
                  {audioState === 'requesting' && 'Getting microphone…'}
                  {audioState === 'recording' && 'Listening… tap to stop'}
                  {audioState === 'transcribing' && 'Transcribing…'}
                </span>
              )}
            </div>
            <Button
              type="button"
              size="icon"
              className="size-12 shrink-0"
              onClick={() => void sendMessage()}
              disabled={isSending || audioState !== 'idle' || (!input.trim() && !photo)}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {speechError && (
            <p className="text-sm leading-5 text-destructive" role="alert">
              {speechError}
            </p>
          )}
        </div>
      </div>}
    </div>
  )
}
