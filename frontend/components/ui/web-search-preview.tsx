"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import Markdown from "@/components/ui/markdown"
import { Save, Download } from "lucide-react"
import { toast } from "sonner"

interface WebSearchPreviewProps {
  content: string
  topic: string
  onSave: () => void
  onClose: () => void
}

export function WebSearchPreview({
  content,
  topic,
  onSave,
  onClose,
}: WebSearchPreviewProps) {
  const handleDownload = () => {
    if (!content) {
      toast.error("No content to download")
      return
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${topic || "Web Search Results"}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1, h2, h3 {
              color: #333;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${topic || "web-search"}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Content downloaded")
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto" style={{ width: "1200px", maxWidth: "1200px" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Web Search Results Preview</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onSave}
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 border rounded-lg p-6 bg-muted/50 max-h-[70vh] overflow-y-auto">
          <Markdown content={content} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

