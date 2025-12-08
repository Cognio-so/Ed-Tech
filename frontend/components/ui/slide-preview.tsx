"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Download, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface SlidePreviewProps {
  content: {
    presentation_url?: string
    status?: string
    [key: string]: any
  }
  onSave: () => void
  onClose: () => void
  buttonText?: string; // Custom button text (default: "Save")
}

export function SlidePreview({ content, onSave, onClose, buttonText = "Save" }: SlidePreviewProps) {
  const handleDownload = () => {
    if (content.presentation_url) {
      window.open(content.presentation_url, "_blank")
      toast.success("Opening presentation link")
    } else {
      toast.error("No presentation URL available")
    }
  }

  const handleCopyLink = () => {
    if (content.presentation_url) {
      navigator.clipboard.writeText(content.presentation_url)
      toast.success("Link copied to clipboard")
    } else {
      toast.error("No presentation URL available")
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Slide Presentation Preview</span>
            <div className="flex gap-2 mr-8">
              {content.presentation_url && (
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
                {buttonText}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {content.presentation_url ? (
            <div className="border rounded-lg p-6 bg-muted/50">
              <div className="space-y-2">
                <p className="font-semibold">Presentation URL:</p>
                <a
                  href={content.presentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {content.presentation_url}
                </a>
                <p className="text-sm text-muted-foreground mt-4">
                  Status: {content.status || "Success"}
                </p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-6 bg-muted/50">
              <p className="text-muted-foreground">
                {content.status === "processing" 
                  ? "Presentation is being generated. Please wait..." 
                  : "Presentation data will appear here once generated."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

