"use client"

import React from "react"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { UIMessage } from "ai"
import { Search, CheckCircle2, LayoutGrid, ArrowRightLeft, Lightbulb, AlertTriangle } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

function getUIMessageText(msg: UIMessage): string {
  if (!msg.parts || !Array.isArray(msg.parts)) return ""
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

interface ToolCallInfo {
  toolName: string
  args: Record<string, unknown>
  state: string
}

function getToolCalls(messages: UIMessage[]): ToolCallInfo[] {
  const calls: ToolCallInfo[] = []
  for (const msg of messages) {
    if (!msg.parts) continue
    for (const part of msg.parts) {
      if (part.type === "tool-invocation") {
        calls.push({
          toolName: part.toolInvocation.toolName,
          args: part.toolInvocation.args as Record<string, unknown>,
          state: part.toolInvocation.state,
        })
      }
    }
  }
  return calls
}

// Parse the full markdown text into sections based on SECTION headers
function parseSections(text: string) {
  const sections: { title: string; content: string; key: string }[] = []

  // Match section headers like "## SECTION 1 — ...", "**SECTION 1 — ...**", "SECTION 1 — ..." etc.
  const sectionRegex = /(?:^|\n)(?:#{1,3}\s*)?(?:\*{0,2})?\s*(?:SECTION\s*\d+\s*[-—:]+\s*)(.+?)(?:\*{0,2})?\s*\n/gi

  const matches: { index: number; title: string }[] = []
  let match: RegExpExecArray | null

  // Also try simpler patterns
  const lines = text.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const sectionMatch = line.match(
      /^(?:#{1,3}\s*)?(?:\*{0,2})?\s*SECTION\s*(\d+)\s*[-—:]+\s*(.+?)(?:\*{0,2})?\s*$/i
    )
    if (sectionMatch) {
      matches.push({
        index: text.indexOf(lines[i]),
        title: sectionMatch[2].trim(),
      })
    }
  }

  if (matches.length === 0) {
    // No sections found, return the whole text as one section
    return [{ title: "Report", content: text, key: "report" }]
  }

  for (let i = 0; i < matches.length; i++) {
    const start = text.indexOf("\n", matches[i].index) + 1
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const content = text.slice(start, end).trim()
    const key = `section-${i + 1}`

    sections.push({ title: matches[i].title, content, key })
  }

  return sections
}

const TAB_ICONS: Record<number, React.ReactNode> = {
  0: <LayoutGrid className="h-3.5 w-3.5" />,
  1: <ArrowRightLeft className="h-3.5 w-3.5" />,
  2: <Lightbulb className="h-3.5 w-3.5" />,
  3: <AlertTriangle className="h-3.5 w-3.5" />,
}

interface ResultsDisplayProps {
  messages: UIMessage[]
  isStreaming: boolean
}

export function ResultsDisplay({ messages, isStreaming }: ResultsDisplayProps) {
  const assistantMessages = messages.filter((m) => m.role === "assistant")
  const toolCalls = getToolCalls(messages)
  const lastAssistant =
    assistantMessages.length > 0
      ? assistantMessages[assistantMessages.length - 1]
      : null
  const text = lastAssistant ? getUIMessageText(lastAssistant) : ""

  const hasToolCalls = toolCalls.length > 0
  const allToolsDone = toolCalls.every((tc) => tc.state === "output-available")
  const isResearching = hasToolCalls && !allToolsDone

  const sections = useMemo(() => parseSections(text), [text])
  const hasSections = sections.length > 1

  if (!lastAssistant && !hasToolCalls) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        <span>Preparing your optimization report...</span>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col gap-6">
      {/* Research Progress */}
      {hasToolCalls && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">
              {isResearching
                ? "Researching your cards online..."
                : "Card research complete"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {toolCalls.map((tc, i) => {
              const isDone = tc.state === "output-available"
              const cardName = (tc.args.cardName as string) || "Unknown"
              const bank = (tc.args.bank as string) || ""
              return (
                <div
                  key={`${cardName}-${bank}-${i}`}
                  className="flex items-center gap-2 text-sm"
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 border-t-accent animate-spin shrink-0" />
                  )}
                  <span
                    className={
                      isDone ? "text-foreground/70" : "text-foreground"
                    }
                  >
                    {cardName}
                    {bank ? ` — ${bank}` : ""}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && !isResearching && text.length > 0 && (
        <div className="sticky top-0 z-10 flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-4 py-2 text-sm">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-foreground/70">
            Generating your report...
          </span>
        </div>
      )}

      {/* Tabbed Report */}
      {text.length > 0 && hasSections && !isStreaming ? (
        <Tabs defaultValue={sections[0].key} className="w-full">
          <TabsList className="w-full flex h-auto flex-wrap gap-1 bg-secondary/50 p-1.5 rounded-lg">
            {sections.map((section, idx) => (
              <TabsTrigger
                key={section.key}
                value={section.key}
                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md"
              >
                {TAB_ICONS[idx] || null}
                <span className="hidden sm:inline">{section.title}</span>
                <span className="sm:hidden">{section.title.split(" ").slice(0, 2).join(" ")}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {sections.map((section) => (
            <TabsContent key={section.key} value={section.key} className="mt-4">
              <MarkdownContent content={section.content} />
            </TabsContent>
          ))}
        </Tabs>
      ) : text.length > 0 ? (
        // While streaming or if no sections detected, show full text
        <MarkdownContent content={text} />
      ) : null}

      {/* Streaming cursor */}
      {isStreaming && text.length > 0 && (
        <span className="inline-block w-1.5 h-5 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-foreground mt-8 mb-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-foreground/80 leading-relaxed mb-4">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary text-secondary-foreground">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-foreground whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-foreground/80 border-t border-border">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-secondary/50 transition-colors">
              {children}
            </tr>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-5 mb-4 text-foreground/80 flex flex-col gap-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-5 mb-4 text-foreground/80 flex flex-col gap-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          hr: () => <hr className="my-8 border-border" />,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-accent pl-4 my-4 text-foreground/70 italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-")
            if (isBlock) {
              return (
                <code className="block bg-secondary rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-secondary rounded px-1.5 py-0.5 text-sm font-mono text-foreground">
                {children}
              </code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}
