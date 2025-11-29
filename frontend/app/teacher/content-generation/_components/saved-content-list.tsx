"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Response } from "@/components/ui/response"
import { Edit, Trash2, Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { deleteContent } from "../action"

interface Content {
  id: string
  contentType: string
  title: string
  content: string
  grade?: string | null
  subject?: string | null
  topic?: string | null
  createdAt: Date
  updatedAt: Date
}

export function SavedContentList() {
  const [savedContents, setSavedContents] = React.useState<Content[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetchSavedContents()
  }, [])

  const fetchSavedContents = async () => {
    try {
      const response = await fetch("/api/content")
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setSavedContents(data)
        } else {
          setSavedContents([])
        }
      } else {
        setSavedContents([])
      }
    } catch (error) {
      console.error("Error fetching contents:", error)
      setSavedContents([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this content?")) return

    try {
      await deleteContent(id)
      toast.success("Content deleted successfully")
      setSavedContents(savedContents.filter((c) => c.id !== id))
    } catch (error) {
      toast.error("Failed to delete content")
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Content copied to clipboard")
  }

  const handleDownload = (content: string, title: string) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
        </head>
        <body>
          <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${content}</pre>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "application/msword" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title || "content"}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Content downloaded")
  }

  const handleEdit = (content: Content) => {
    // Store content in sessionStorage and switch to form tab
    sessionStorage.setItem("editContent", JSON.stringify(content))
    // Dispatch event to switch tabs
    window.dispatchEvent(new CustomEvent("switchToFormTab"))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading saved content...</p>
      </div>
    )
  }

  if (!Array.isArray(savedContents) || savedContents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No saved content yet</p>
        <p className="text-muted-foreground text-sm mt-2">
          Generate and save content to see it here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Saved Content</h2>
          <p className="text-muted-foreground mt-1">
            Manage your saved educational content
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {savedContents.length} {savedContents.length === 1 ? "item" : "items"}
        </div>
      </div>

      <div className="space-y-4">
        {savedContents.map((content) => (
          <div
            key={content.id}
            className="border rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{content.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="capitalize">{content.contentType.replace("_", " ")}</span>
                  {content.topic && (
                    <>
                      <span>•</span>
                      <span>{content.topic}</span>
                    </>
                  )}
                  {content.grade && (
                    <>
                      <span>•</span>
                      <span>Grade {content.grade}</span>
                    </>
                  )}
                  {content.subject && (
                    <>
                      <span>•</span>
                      <span>{content.subject}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(content)}
                  title="Edit content"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(content.content)}
                  title="Copy content"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(content.content, content.title)}
                  title="Download content"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(content.id)}
                  title="Delete content"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="border rounded-lg p-4 bg-muted/50 max-h-[500px] overflow-y-auto">
              <Response content={content.content} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

