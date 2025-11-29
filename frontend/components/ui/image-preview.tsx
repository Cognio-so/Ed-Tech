"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Download } from "lucide-react"
import { toast } from "sonner"

interface ImagePreviewProps {
  imageUrl: string
  topic: string
  onSave: () => void
  onClose: () => void
}

export function ImagePreview({ imageUrl, topic, onSave, onClose }: ImagePreviewProps) {
  const handleDownload = () => {
    if (!imageUrl) {
      toast.error("No image to download")
      return
    }

    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `${topic || "image"}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Image downloaded")
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Image Preview</span>
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
        <div className="mt-4 border rounded-lg p-6 bg-muted/50">
          <img
            src={imageUrl}
            alt={topic}
            className="w-full h-auto rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

