"use client"

import * as React from "react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Download, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

export interface ContentCardProps {
  id: string
  title: string
  imageUrl?: string
  imageAlt?: string
  type: string
  contentType: string
  grade?: string | null
  subject?: string | null
  topic?: string | null
  date?: Date | string
  onPreview: () => void
  onDownload: () => void
  onDelete: () => void
  className?: string
}

export function ContentCard({
  id,
  title,
  imageUrl,
  imageAlt,
  type,
  contentType,
  grade,
  subject,
  topic,
  date,
  onPreview,
  onDownload,
  onDelete,
  className,
}: ContentCardProps) {
  const formatDate = (date?: Date | string) => {
    if (!date) return ""
    const d = typeof date === "string" ? new Date(date) : date
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getTypeLabel = () => {
    const typeMap: Record<string, string> = {
      assessment: "Assessments",
      lesson_plan: "Content",
      presentation: "Content",
      quiz: "Content",
      worksheet: "Content",
      slide: "Slides",
      image: "Images",
      video: "Videos",
      comic: "Comics",
      web: "Web Search",
    }
    return typeMap[contentType] || "Content"
  }

  return (
    <Card className={cn("overflow-hidden flex flex-col w-full p-0 gap-0", className)}>
      {/* Image section - no padding/margin between card and image */}
      <div className="relative w-full aspect-video bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt || title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <div className="text-center p-4">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
            </div>
          </div>
        )}
        {/* Type badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className="bg-black/80 text-white border-0">
            {getTypeLabel()}
          </Badge>
        </div>
      </div>

      {/* Content section */}
      <CardHeader className="flex-1 px-6 pt-6">
        <h3 className="font-semibold text-lg leading-tight line-clamp-2">{title}</h3>
        <div className="space-y-2 text-sm text-muted-foreground mt-2">
          {topic && (
            <div>
              <span className="font-medium">Topic:</span> {topic}
            </div>
          )}
          {subject && (
            <div>
              <span className="font-medium">Subject:</span> {subject}
            </div>
          )}
          {grade && (
            <div>
              <span className="font-medium">Grade:</span> {grade}
            </div>
          )}
          {date && (
            <div>
              <span className="font-medium">Date:</span> {formatDate(date)}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Action buttons */}
      <CardFooter className="flex items-center justify-between gap-2 px-6 pb-6 pt-0">
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={onPreview}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDownload}
          title="Download"
        >
              <Download className="h-4 w-4" />
            </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

