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
import { Copy, Download, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DownloadDialog } from "@/components/ui/download-dialog";

interface ContentPreviewProps {
  content: string;
  title: string;
  onCopy?: () => void;
  onDownload?: () => void;
  onSave?: () => void | Promise<void>;
  onClose: () => void;
}

export function ContentPreview({
  content,
  title,
  onCopy,
  onDownload,
  onSave,
  onClose,
}: ContentPreviewProps) {
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async () => {
    if (!onSave) return;
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
    if (onCopy) {
      onCopy();
    } else {
      navigator.clipboard.writeText(content);
      toast.success("Content copied to clipboard");
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      setShowDownloadDialog(true);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              {onSave && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
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
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 border rounded-lg p-6 bg-muted/50 max-h-[70vh] overflow-y-auto">
          <Markdown content={content} />
        </div>
      </DialogContent>

      {/* Download Dialog */}
      <DownloadDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        content={content}
        title={title}
      />
    </Dialog>
  );
}
