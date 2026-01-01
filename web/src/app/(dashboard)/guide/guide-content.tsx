'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDownIcon, ChevronRightIcon } from '@/components/ui/icons'

interface GuideDoc {
  slug: string
  title: string
  content: string
}

export function GuideContent({ docs }: { docs: GuideDoc[] }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(docs[0]?.slug ?? null)

  return (
    <div className="space-y-4">
      {docs.map(doc => {
        const isExpanded = expandedSlug === doc.slug

        return (
          <div key={doc.slug} className="border border-border rounded-sm">
            <button
              onClick={() => setExpandedSlug(isExpanded ? null : doc.slug)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium text-foreground">{doc.title}</span>
              {isExpanded ? (
                <ChevronDownIcon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {isExpanded && (
              <div className="px-4 pb-6 border-t border-border">
                <article className="prose prose-sm max-w-none pt-4
                  prose-headings:font-serif prose-headings:text-foreground prose-headings:font-normal
                  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-li:text-muted-foreground
                  prose-strong:text-foreground prose-strong:font-medium
                  prose-code:text-accent prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-muted prose-pre:border prose-pre:border-border
                  prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                  prose-table:border-collapse prose-table:w-full prose-table:text-sm
                  prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-foreground prose-th:font-medium
                  prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2 prose-td:text-muted-foreground
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
                </article>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
