"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCard } from "@/components/ui/content-card";
import { LibraryContent } from "@/data/get-library-content";
import { AssessmentPreview } from "@/app/teacher/assessment-generation/_components/assessment-preview";
import { SlidePreview } from "@/components/ui/slide-preview";
import { ImagePreview } from "@/components/ui/image-preview";
import { VideoPreview } from "@/components/ui/video-preview";
import { ComicPreview } from "@/components/ui/comic-preview";
import { WebSearchPreview } from "@/components/ui/web-search-preview";
import { ContentPreview } from "@/app/teacher/media-toolkit/_components/content-preview";
import { DownloadDialog } from "@/components/ui/download-dialog";
import { toast } from "sonner";
import { deleteMediaContent } from "@/app/teacher/media-toolkit/action";
import { deleteAssessment } from "@/app/teacher/assessment-generation/action";
import { deleteContent } from "@/app/teacher/content-generation/action";
import { deleteExam } from "@/app/teacher/exam-generator/action";
import { addToLesson } from "@/app/teacher/library/action";
import { useRouter } from "next/navigation";
import { ExamFormPreview } from "@/app/teacher/exam-generator/_components/exam-form-preview";

interface AllTabsProps {
  content: LibraryContent[];
}

export function AllTabs({ content }: AllTabsProps) {
  const router = useRouter();
  const [previewItem, setPreviewItem] = React.useState<LibraryContent | null>(
    null
  );
  const [localContent, setLocalContent] = React.useState(content);
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [downloadContent, setDownloadContent] = React.useState<{
    content: string;
    title: string;
  } | null>(null);

  const mediaToolkitContent = localContent.filter(
    (item) => item.type === "media-toolkit"
  );
  const contentGenerationContent = localContent.filter(
    (item) => item.type === "content-generation"
  );
  const assessmentContent = localContent.filter(
    (item) => item.type === "assessment"
  );
  const examContent = localContent.filter(
    (item) => item.type === "exam"
  );

  const counts = {
    all: localContent.length,
    content: contentGenerationContent.length,
    slides: mediaToolkitContent.filter((item) => item.contentType === "slide")
      .length,
    comics: mediaToolkitContent.filter((item) => item.contentType === "comic")
      .length,
    images: mediaToolkitContent.filter((item) => item.contentType === "image")
      .length,
    videos: mediaToolkitContent.filter((item) => item.contentType === "video")
      .length,
    assessments: assessmentContent.length,
    exams: examContent.length,
    webSearch: mediaToolkitContent.filter((item) => item.contentType === "web")
      .length,
  };

  const handlePreview = (item: LibraryContent) => {
    setPreviewItem(item);
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
  };

  const handleDownload = async (item: LibraryContent) => {
    try {
      if (!item.content) {
        toast.error("No content to download");
        return;
      }

      let contentToDownload = item.content;

      try {
        const parsed = JSON.parse(item.content);
        if (parsed.presentation_url) {
          window.open(parsed.presentation_url, "_blank");
          toast.success("Opening presentation link");
          return;
        }
        if (parsed.video_url) {
          window.open(parsed.video_url, "_blank");
          toast.success("Opening video link");
          return;
        }
        contentToDownload = JSON.stringify(parsed, null, 2);
      } catch {}

      setDownloadContent({
        content: contentToDownload,
        title: item.title,
      });
      setShowDownloadDialog(true);
    } catch (error) {
      console.error("Error downloading content:", error);
      toast.error("Failed to download content");
    }
  };

  const handleDelete = async (item: LibraryContent) => {
    if (!confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }

    try {
      if (item.type === "media-toolkit") {
        await deleteMediaContent(item.id, item.contentType);
      } else if (item.type === "assessment") {
        await deleteAssessment(item.id);
      } else if (item.type === "content-generation") {
        await deleteContent(item.id);
      } else if (item.type === "exam") {
        await deleteExam(item.id);
      } else {
        toast.error("Delete functionality not available for this content type");
        return;
      }

      setLocalContent(localContent.filter((c) => c.id !== item.id));
      toast.success("Content deleted successfully");
      router.refresh();
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content");
    }
  };

  const handleAddToLesson = async (item: LibraryContent) => {
    try {
      const formData = new FormData();
      formData.append("contentType", item.contentType);
      formData.append("contentId", item.id);
      formData.append("lessonName", `Lesson - ${new Date().toLocaleDateString()}`);

      await addToLesson(formData);
      toast.success("Content added to lesson successfully");
    } catch (error) {
      console.error("Error adding content to lesson:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add content to lesson"
      );
    }
  };

  const renderPreview = () => {
    if (!previewItem) return null;

    const contentType = previewItem.contentType;
    const content = previewItem.content;

    let parsedContent: any = null;
    try {
      parsedContent = JSON.parse(content);
    } catch {}

    if (contentType === "assessment") {
      return (
        <AssessmentPreview
          content={content}
          topic={previewItem.topic || previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "exam") {
      return (
        <ExamFormPreview
          content={content}
          title={previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "slide") {
      return (
        <SlidePreview
          content={parsedContent || { content }}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "image") {
      const imageUrl =
        parsedContent?.image_url || parsedContent?.url || content;
      return (
        <ImagePreview
          imageUrl={imageUrl}
          topic={previewItem.topic || previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "video") {
      return (
        <VideoPreview
          content={parsedContent || { content }}
          title={previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "comic") {
      return (
        <ComicPreview
          content={parsedContent || { content }}
          topic={previewItem.topic || previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    if (contentType === "web") {
      return (
        <WebSearchPreview
          content={content}
          topic={previewItem.topic || previewItem.title}
          onSave={handleClosePreview}
          onClose={handleClosePreview}
        />
      );
    }

    return (
      <ContentPreview
        content={content}
        title={previewItem.title}
        onCopy={() => {
          navigator.clipboard.writeText(content);
          toast.success("Content copied to clipboard");
        }}
        onDownload={() => handleDownload(previewItem)}
        onClose={handleClosePreview}
      />
    );
  };

  const renderContentGrid = (items: LibraryContent[]) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <p>No content found in this category.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => {
          let imageUrl: string | undefined;

          if (item.contentType === "image") {
            imageUrl = item.content;
          } else if (item.contentType === "comic") {
            try {
              const parsed = JSON.parse(item.content);
              if (
                parsed.panels &&
                Array.isArray(parsed.panels) &&
                parsed.panels.length > 0
              ) {
                imageUrl = parsed.panels[0].url;
              }
            } catch {}
          } else {
            try {
              const parsed = JSON.parse(item.content);
              imageUrl =
                parsed.image_url || parsed.url || parsed.presentation_url;
            } catch {}
          }

          return (
            <ContentCard
              key={item.id}
              id={item.id}
              title={item.title}
              imageUrl={imageUrl}
              imageAlt={item.title}
              type={item.type}
              contentType={item.contentType}
              grade={item.grade}
              subject={item.subject}
              topic={item.topic}
              date={item.createdAt}
              onPreview={() => handlePreview(item)}
              onDownload={() => handleDownload(item)}
              onDelete={() => handleDelete(item)}
              onAddToLesson={() => handleAddToLesson(item)}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Tabs defaultValue="all" className="w-full">
        <div className="overflow-x-auto mb-6">
          <TabsList className="inline-flex w-full min-w-max gap-2">
            <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="content">
              Content ({counts.content})
            </TabsTrigger>
            <TabsTrigger value="slides">Slides ({counts.slides})</TabsTrigger>
            <TabsTrigger value="comics">Comics ({counts.comics})</TabsTrigger>
            <TabsTrigger value="images">Images ({counts.images})</TabsTrigger>
            <TabsTrigger value="videos">Videos ({counts.videos})</TabsTrigger>
            <TabsTrigger value="assessments">
              Assessments ({counts.assessments})
            </TabsTrigger>
            <TabsTrigger value="exams">
              Exams ({counts.exams})
            </TabsTrigger>
            <TabsTrigger value="webSearch">
              Web Search ({counts.webSearch})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          {renderContentGrid(localContent)}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          {renderContentGrid(contentGenerationContent)}
        </TabsContent>

        <TabsContent value="slides" className="mt-6">
          {renderContentGrid(
            mediaToolkitContent.filter((item) => item.contentType === "slide")
          )}
        </TabsContent>

        <TabsContent value="comics" className="mt-6">
          {renderContentGrid(
            mediaToolkitContent.filter((item) => item.contentType === "comic")
          )}
        </TabsContent>

        <TabsContent value="images" className="mt-6">
          {renderContentGrid(
            mediaToolkitContent.filter((item) => item.contentType === "image")
          )}
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          {renderContentGrid(
            mediaToolkitContent.filter((item) => item.contentType === "video")
          )}
        </TabsContent>

        <TabsContent value="assessments" className="mt-6">
          {renderContentGrid(assessmentContent)}
        </TabsContent>

        <TabsContent value="exams" className="mt-6">
          {renderContentGrid(examContent)}
        </TabsContent>

        <TabsContent value="webSearch" className="mt-6">
          {renderContentGrid(
            mediaToolkitContent.filter((item) => item.contentType === "web")
          )}
        </TabsContent>
      </Tabs>

      {renderPreview()}

      {/* Download Dialog */}
      {downloadContent && (
        <DownloadDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          content={downloadContent.content}
          title={downloadContent.title}
        />
      )}
    </>
  );
}
