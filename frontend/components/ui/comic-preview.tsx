"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Download } from "lucide-react"
import { toast } from "sonner"

interface ComicPanel {
  index: number
  url: string
  footer_text: string
  prompt: string
}

interface ComicPreviewProps {
  content: {
    story?: string
    panels?: ComicPanel[]
  }
  topic: string
  onSave: () => void
  onClose: () => void
}

export function ComicPreview({
  content,
  topic,
  onSave,
  onClose,
}: ComicPreviewProps) {
  const handleDownload = () => {
    if (!content.panels || content.panels.length === 0) {
      toast.error("No comic panels to download")
      return
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${topic || "Comic"}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .comic-container {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 20px;
              margin-top: 20px;
            }
            .panel {
              background: white;
              border-radius: 8px;
              padding: 15px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .panel img {
              width: 100%;
              height: auto;
              border-radius: 4px;
            }
            .panel-footer {
              margin-top: 10px;
              padding-top: 10px;
              border-top: 1px solid #eee;
              font-size: 14px;
              color: #666;
            }
            .story {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <h1>${topic || "Comic"}</h1>
          ${content.story ? `<div class="story">${content.story.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
          <div class="comic-container">
            ${content.panels?.map((panel) => `
              <div class="panel">
                <img src="${panel.url}" alt="Panel ${panel.index}" />
                ${panel.footer_text ? `<div class="panel-footer">${panel.footer_text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}
              </div>
            `).join("") || ""}
          </div>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${topic || "comic"}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Comic downloaded")
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Comic Preview</span>
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
        <div className="mt-4 space-y-4">
          {content.story && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Story</h3>
              <p className="whitespace-pre-wrap text-sm">{content.story}</p>
            </div>
          )}
          {content.panels && content.panels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.panels.map((panel) => (
                <div key={panel.index} className="border rounded-lg p-4 bg-muted/50">
                  {panel.url ? (
                    <img
                      src={panel.url}
                      alt={`Panel ${panel.index}`}
                      className="w-full h-auto rounded-lg mb-2"
                      onError={(e) => {
                        console.error("Image load error for panel", panel.index, panel.url?.substring(0, 50))
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted rounded-lg mb-2 flex items-center justify-center">
                      <p className="text-muted-foreground">Loading image...</p>
                    </div>
                  )}
                  {panel.footer_text && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {panel.footer_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/50 text-center">
              <p className="text-muted-foreground">No panels available. Images may still be generating...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

