"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ResponseProps {
  content: string
  className?: string
}

export function Response({ content, className }: ResponseProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:text-foreground/90 prose-p:leading-relaxed",
        "prose-ul:text-foreground/90 prose-ol:text-foreground/90",
        "prose-li:text-foreground/90",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-code:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border",
        "prose-a:text-primary prose-a:underline-offset-4",
        "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

