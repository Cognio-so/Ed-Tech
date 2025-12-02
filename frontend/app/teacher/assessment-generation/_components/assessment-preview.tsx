"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Markdown from "@/components/ui/markdown";
import { Save, Copy, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DownloadDialog } from "@/components/ui/download-dialog";

interface AssessmentPreviewProps {
  content?: string;
  streamingContent?: string;
  isStreaming?: boolean;
  topic: string;
  onSave: () => void | Promise<void>;
  onClose: () => void;
}

export function AssessmentPreview({
  content,
  streamingContent,
  isStreaming = false,
  topic,
  onSave,
  onClose,
}: AssessmentPreviewProps) {
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Use streaming content if available, otherwise fall back to regular content
  const displayContent = streamingContent || content || "";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    if (!displayContent) {
      toast.error("No content to copy");
      return;
    }
    navigator.clipboard.writeText(displayContent);
    toast.success("Assessment copied to clipboard");
  };

  const handleDownload = () => {
    if (!displayContent) {
      toast.error("No content to download");
      return;
    }
    setShowDownloadDialog(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isStreaming) {
        toast.info("Please wait for assessment generation to complete");
        return;
      }
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="!w-[1200px] !max-w-[1200px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (isStreaming || displayContent) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (isStreaming) {
            e.preventDefault();
            toast.info("Please wait for assessment generation to complete");
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Assessment Preview</span>
            <div className="flex gap-2 mr-8">
              <Button variant="outline" size="sm" onClick={handleCopy} disabled={!displayContent}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!displayContent}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isStreaming || !displayContent}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 border rounded-lg p-6 bg-muted/50 max-h-[70vh] overflow-y-auto">
          {isStreaming && !displayContent ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Generating assessment...</span>
            </div>
          ) : (
            <Markdown content={displayContent} />
          )}
        </div>
      </DialogContent>

      <DownloadDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        content={displayContent}
        title={topic || "Assessment"}
      />
    </Dialog>
  );
}
