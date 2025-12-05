"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentCard } from "@/components/ui/content-card";
import { StudentContent } from "@/data/get-student-content";
import { AssessmentPreview } from "@/app/teacher/assessment-generation/_components/assessment-preview";
import { SlidePreview } from "@/components/ui/slide-preview";
import { ImagePreview } from "@/components/ui/image-preview";
import { VideoPreview } from "@/components/ui/video-preview";
import { ComicPreview } from "@/components/ui/comic-preview";
import { WebSearchPreview } from "@/components/ui/web-search-preview";
import { ContentPreview } from "@/app/teacher/media-toolkit/_components/content-preview";
import { DownloadDialog } from "@/components/ui/download-dialog";
import { toast } from "sonner";

interface LibraryTabsProps {
  content: StudentContent[];
}

export function LibraryTabs({ content }: LibraryTabsProps) {
  const [previewItem, setPreviewItem] = React.useState<StudentContent | null>(
    null
  );
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [downloadContent, setDownloadContent] = React.useState<{
    content: string;
    title: string;
  } | null>(null);

  const lessonPlanContent = content.filter(
    (item) => item.contentType === "lesson_plan"
  );
  const presentationContent = content.filter(
    (item) => item.contentType === "presentation"
  );
  const quizContent = content.filter((item) => item.contentType === "quiz");
  const worksheetContent = content.filter(
    (item) => item.contentType === "worksheet"
  );
  const assessmentContent = content.filter(
    (item) => item.contentType === "assessment"
  );
  const slideContent = content.filter((item) => item.contentType === "slide");
  const imageContent = content.filter((item) => item.contentType === "image");
  const videoContent = content.filter((item) => item.contentType === "video");
  const comicContent = content.filter((item) => item.contentType === "comic");

  const counts = {
    all: content.length,
    lessonPlan: lessonPlanContent.length,
    presentation: presentationContent.length,
    quiz: quizContent.length,
    worksheet: worksheetContent.length,
    assessment: assessmentContent.length,
    slide: slideContent.length,
    image: imageContent.length,
    video: videoContent.length,
    comic: comicContent.length,
  };

  const handlePreview = (item: StudentContent) => {
    setPreviewItem(item);
  };

  const handleClosePreview = () => {
    setPreviewItem(null);
  };

  const handleDownload = async (item: StudentContent) => {
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

  const renderContentGrid = (items: StudentContent[]) => {
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

          if (item.imageUrl) {
            imageUrl = item.imageUrl;
          } else if (item.contentType === "image") {
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
              type="content"
              contentType={item.contentType}
              grade={item.grade}
              subject={item.subject}
              topic={item.topic}
              date={item.createdAt}
              onPreview={() => handlePreview(item)}
              onDownload={() => handleDownload(item)}
              onDelete={() => {}}
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
            <TabsTrigger value="lessonPlan">
              Lesson Plans ({counts.lessonPlan})
            </TabsTrigger>
            <TabsTrigger value="presentation">
              Presentations ({counts.presentation})
            </TabsTrigger>
            <TabsTrigger value="quiz">Quizzes ({counts.quiz})</TabsTrigger>
            <TabsTrigger value="worksheet">
              Worksheets ({counts.worksheet})
            </TabsTrigger>
            <TabsTrigger value="assessment">
              Assessments ({counts.assessment})
            </TabsTrigger>
            <TabsTrigger value="slide">Slides ({counts.slide})</TabsTrigger>
            <TabsTrigger value="image">Images ({counts.image})</TabsTrigger>
            <TabsTrigger value="video">Videos ({counts.video})</TabsTrigger>
            <TabsTrigger value="comic">Comics ({counts.comic})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-6">
          {renderContentGrid(content)}
        </TabsContent>

        <TabsContent value="lessonPlan" className="mt-6">
          {renderContentGrid(lessonPlanContent)}
        </TabsContent>

        <TabsContent value="presentation" className="mt-6">
          {renderContentGrid(presentationContent)}
        </TabsContent>

        <TabsContent value="quiz" className="mt-6">
          {renderContentGrid(quizContent)}
        </TabsContent>

        <TabsContent value="worksheet" className="mt-6">
          {renderContentGrid(worksheetContent)}
        </TabsContent>

        <TabsContent value="assessment" className="mt-6">
          {renderContentGrid(assessmentContent)}
        </TabsContent>

        <TabsContent value="slide" className="mt-6">
          {renderContentGrid(slideContent)}
        </TabsContent>

        <TabsContent value="image" className="mt-6">
          {renderContentGrid(imageContent)}
        </TabsContent>

        <TabsContent value="video" className="mt-6">
          {renderContentGrid(videoContent)}
        </TabsContent>

        <TabsContent value="comic" className="mt-6">
          {renderContentGrid(comicContent)}
        </TabsContent>
      </Tabs>

      {renderPreview()}

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
