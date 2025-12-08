"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadToCloudinary } from "@/lib/cloudinary";

interface ImagePreviewProps {
  imageUrl: string;
  topic: string;
  onSave: ((cloudinaryUrl: string) => void | Promise<void>) | (() => void | Promise<void>);
  onClose: () => void;
  skipUpload?: boolean; // If true, skip Cloudinary upload and call onSave directly
  buttonText?: string; // Custom button text (default: "Save")
}

export function ImagePreview({
  imageUrl,
  topic,
  onSave,
  onClose,
  skipUpload = false,
  buttonText = "Save",
}: ImagePreviewProps) {
  const [isUploading, setIsUploading] = React.useState(false);

  const handleDownload = () => {
    if (!imageUrl) {
      toast.error("No image to download");
      return;
    }

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${topic || "image"}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Image downloaded");
  };

  const handleSave = async () => {
    if (!imageUrl) {
      toast.error("No image to save");
      return;
    }

    // If skipUpload is true, call onSave directly without uploading
    if (skipUpload) {
      try {
        await (onSave as () => void | Promise<void>)();
      } catch (error) {
        console.error("Error saving:", error);
        toast.error("Failed to save");
      }
      return;
    }

    setIsUploading(true);
    try {
      // Upload to Cloudinary first
      toast.info("Uploading image to Cloudinary...");
      const cloudinaryUrl = await uploadToCloudinary(
        imageUrl,
        `image_${topic?.replace(/\s+/g, "_") || "image"}_${Date.now()}`
      );
      
      // Call onSave with the Cloudinary URL
      await (onSave as (cloudinaryUrl: string) => void | Promise<void>)(cloudinaryUrl);
      toast.success("Image saved successfully");
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to upload and save image"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Image Preview</span>
            <div className="flex gap-2 mr-8">
              <Button variant="outline" size="sm" onClick={handleDownload}>
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
        <div className="mt-4 border rounded-lg bg-muted/50">
          <img
            src={imageUrl}
            alt={topic}
            className="w-full h-auto rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
