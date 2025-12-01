"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileCode } from "lucide-react";
import { DownloadFormat, downloadContent } from "@/lib/download-content";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title: string;
}

export function DownloadDialog({
  open,
  onOpenChange,
  content,
  title,
}: DownloadDialogProps) {
  const handleDownload = (format: DownloadFormat) => {
    downloadContent(content, title, format);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Download Format</DialogTitle>
          <DialogDescription>
            Select the format you want to download the content in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleDownload("word")}
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Word Document</div>
                <div className="text-sm text-muted-foreground">
                  Download as .doc file
                </div>
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={() => handleDownload("markdown")}
          >
            <div className="flex items-center gap-3">
              <FileCode className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold">Markdown</div>
                <div className="text-sm text-muted-foreground">
                  Download as .md file
                </div>
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

