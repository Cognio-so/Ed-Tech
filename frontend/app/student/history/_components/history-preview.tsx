"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Markdown from "@/components/ui/markdown";

interface HistoryPreviewProps {
  content: string;
  title: string;
  sources?: Array<{ href: string; title: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HistoryPreview({
  content,
  title,
  sources,
  open,
  onOpenChange,
}: HistoryPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[1200px] !max-w-[1200px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 border rounded-lg p-6 bg-muted/50 max-h-[70vh] overflow-y-auto">
          <Markdown content={content} sources={sources} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

