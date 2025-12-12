"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { uploadMultipleToCloudinary } from "@/lib/cloudinary"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"

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
  onSave: (updatedContent: { story?: string; panels?: ComicPanel[] }) => void | Promise<void>
  onClose: () => void
  buttonText?: string; // Custom button text (default: "Save")
}

export function ComicPreview({
  content,
  topic,
  onSave,
  onClose,
  buttonText = "Save",
}: ComicPreviewProps) {
  const [isUploading, setIsUploading] = React.useState(false);

  const handleSave = async () => {
    if (!content.panels || content.panels.length === 0) {
      toast.error("No comic panels to save");
      return;
    }

    setIsUploading(true);
    try {
      // Extract image URLs from panels
      const imageUrls = content.panels.map((panel) => panel.url);
      
      // Upload all images to Cloudinary in parallel
      toast.info("Uploading comic images to Cloudinary...");
      const cloudinaryUrls = await uploadMultipleToCloudinary(
        imageUrls,
        `comic_${topic?.replace(/\s+/g, "_") || "comic"}_${Date.now()}`
      );

      // Update panels with Cloudinary URLs
      const updatedPanels: ComicPanel[] = content.panels.map((panel, index) => ({
        ...panel,
        url: cloudinaryUrls[index],
      }));

      // Create updated content with Cloudinary URLs
      const updatedContent = {
        story: content.story,
        panels: updatedPanels,
      };

      // Call onSave with updated content
      await onSave(updatedContent);
      toast.success("Comic saved successfully");
    } catch (error) {
      console.error("Error saving comic:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload and save comic"
      );
    } finally {
      setIsUploading(false);
    }
  };

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
      <DialogContent className="!w-[800px] !max-w-[800px] max-w-[95vw] !h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Comic Preview</span>
            <div className="flex gap-2 mr-8">
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
                onClick={handleSave}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {buttonText}
                  </>
                )}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4 flex-1 overflow-y-auto">
          {content.story && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Story</h3>
              <p className="whitespace-pre-wrap text-sm">{content.story}</p>
            </div>
          )}
          {content.panels && content.panels.length > 0 ? (
            <div className="relative w-full">
              <Carousel className="w-full">
                <CarouselContent>
                  {content.panels.map((panel) => {
                    const hasImageUrl = panel.url && panel.url.length > 0;
                    const isBase64 = hasImageUrl && panel.url.startsWith("data:image");
                    
                    return (
                      <CarouselItem key={panel.index}>
                        <div className="border rounded-lg p-4 bg-muted/50">
                          {hasImageUrl ? (
                            <div className="relative">
                              <img
                                src={panel.url}
                                alt={`Panel ${panel.index + 1}`}
                                className="w-full h-auto rounded-lg mb-2 object-contain bg-white max-h-[60vh]"
                                loading="lazy"
                                onError={(e) => {
                                  console.error("Image load error for panel", panel.index, {
                                    urlLength: panel.url?.length,
                                    urlPreview: panel.url?.substring(0, 100),
                                    isBase64: isBase64
                                  });
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const errorDiv = document.createElement('div');
                                    errorDiv.className = 'w-full h-48 bg-muted rounded-lg mb-2 flex items-center justify-center';
                                    errorDiv.innerHTML = '<p class="text-muted-foreground text-sm">Failed to load image</p>';
                                    parent.appendChild(errorDiv);
                                  }
                                }}
                                onLoad={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'block';
                                  console.log("Panel image loaded successfully:", panel.index);
                                }}
                              />
                              {isBase64 && (
                                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                  Base64 Image
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-48 bg-muted rounded-lg mb-2 flex items-center justify-center">
                              <div className="text-center">
                                <p className="text-muted-foreground">Generating panel {panel.index + 1}...</p>
                                {panel.prompt && (
                                  <p className="text-xs text-muted-foreground mt-2 max-w-xs truncate">
                                    {panel.prompt.substring(0, 100)}...
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {panel.footer_text && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {panel.footer_text}
                            </p>
                          )}
                          <div className="text-xs text-muted-foreground mt-2 text-center">
                            Panel {panel.index + 1} of {content.panels?.length || 0}
                          </div>
                        </div>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
                  <ChevronLeft className="h-4 w-4" />
                </CarouselPrevious>
                <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                  <ChevronRight className="h-4 w-4" />
                </CarouselNext>
              </Carousel>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-muted/50 text-center">
              <p className="text-muted-foreground">No panels available. Images may still be generating...</p>
              {content.story && (
                <p className="text-xs text-muted-foreground mt-2">
                  Story content is ready, waiting for images...
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

