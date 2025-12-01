"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Download, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface VideoPreviewProps {
  content: {
    task_id?: string
    video_url?: string
    status?: string
    [key: string]: any
  }
  title: string
  onSave: () => void
  onClose: () => void
}

export function VideoPreview({ content, title, onSave, onClose }: VideoPreviewProps) {
  const handleDownload = () => {
    if (content.video_url) {
      window.open(content.video_url, "_blank")
      toast.success("Opening video link")
    } else {
      toast.error("No video URL available")
    }
  }

  const handleCopyLink = () => {
    if (content.video_url) {
      navigator.clipboard.writeText(content.video_url)
      toast.success("Link copied to clipboard")
    } else {
      toast.error("No video URL available")
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Video Preview</span>
            <div className="flex gap-2 mr-8">
              {content.video_url && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                  >
                    Copy Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </Button>
                </>
              )}
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
          {content.video_url ? (
            <div className="border rounded-lg p-6 bg-muted/50">
              <div className="space-y-2">
                <p className="font-semibold">Video URL:</p>
                <a
                  href={content.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {content.video_url}
                </a>
                <p className="text-sm text-muted-foreground mt-4">
                  Status: {content.status || "Success"}
                </p>
              </div>
            </div>
          ) : content.task_id ? (
            <div className="border rounded-lg p-6 bg-muted/50">
              <p className="text-muted-foreground">
                Video is being generated. Task ID: {content.task_id}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Status: {content.status || "Processing"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-muted/50">
              <p className="text-muted-foreground">
                Video data will appear here once generated.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

