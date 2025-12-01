"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Copy, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { deleteContent } from "../action";
import { ContentPreview } from "../../media-toolkit/_components/content-preview";
import { DownloadDialog } from "@/components/ui/download-dialog";

interface Content {
  id: string;
  contentType: string;
  title: string;
  content: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function SavedContentList() {
  const [savedContents, setSavedContents] = React.useState<Content[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [previewContent, setPreviewContent] = React.useState<Content | null>(
    null
  );
  const [showPreview, setShowPreview] = React.useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [downloadContent, setDownloadContent] = React.useState<{
    content: string;
    title: string;
  } | null>(null);

  React.useEffect(() => {
    fetchSavedContents();
  }, []);

  const fetchSavedContents = async () => {
    try {
      const response = await fetch("/api/content");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setSavedContents(data);
        } else {
          setSavedContents([]);
        }
      } else {
        setSavedContents([]);
      }
    } catch (error) {
      console.error("Error fetching contents:", error);
      setSavedContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this content?")) return;

    try {
      await deleteContent(id);
      toast.success("Content deleted successfully");
      setSavedContents(savedContents.filter((c) => c.id !== id));
    } catch (error) {
      toast.error("Failed to delete content");
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Content copied to clipboard");
  };

  const handleDownload = (content: string, title: string) => {
    setDownloadContent({ content, title });
    setShowDownloadDialog(true);
  };

  const handleEdit = (content: Content) => {
    // Store content in sessionStorage and switch to form tab
    sessionStorage.setItem("editContent", JSON.stringify(content));
    // Dispatch event to switch tabs
    window.dispatchEvent(new CustomEvent("switchToFormTab"));
  };

  const handlePreview = (content: Content) => {
    setPreviewContent(content);
    setShowPreview(true);
  };

  const handlePreviewCopy = () => {
    if (previewContent) {
      navigator.clipboard.writeText(previewContent.content);
      toast.success("Content copied to clipboard");
    }
  };

  const handlePreviewDownload = () => {
    if (previewContent) {
      setDownloadContent({
        content: previewContent.content,
        title: previewContent.title,
      });
      setShowDownloadDialog(true);
    }
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setPreviewContent(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border rounded-lg p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!Array.isArray(savedContents) || savedContents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No saved content yet</p>
        <p className="text-muted-foreground text-sm mt-2">
          Generate and save content to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {savedContents.map((content) => (
          <div
            key={content.id}
            className="border rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{content.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="capitalize">
                    {content.contentType.replace("_", " ")}
                  </span>
                  {content.topic && (
                    <>
                      <span>•</span>
                      <span>{content.topic}</span>
                    </>
                  )}
                  {content.grade && (
                    <>
                      <span>•</span>
                      <span>Grade {content.grade}</span>
                    </>
                  )}
                  {content.subject && (
                    <>
                      <span>•</span>
                      <span>{content.subject}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    {new Date(content.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(content)}
                  title="Preview content"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(content)}
                  title="Edit content"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(content.content)}
                  title="Copy content"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(content.content, content.title)}
                  title="Download content"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(content.id)}
                  title="Delete content"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Dialog */}
      {showPreview && previewContent && (
        <ContentPreview
          content={previewContent.content}
          title={previewContent.title}
          onCopy={handlePreviewCopy}
          onDownload={handlePreviewDownload}
          onClose={handlePreviewClose}
        />
      )}

      {/* Download Dialog */}
      {downloadContent && (
        <DownloadDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          content={downloadContent.content}
          title={downloadContent.title}
        />
      )}
    </div>
  );
}
