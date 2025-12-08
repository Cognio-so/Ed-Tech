"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LearningLibraryCard } from "./learning-library-card";
import { LearningDialog } from "./learning-dialog";
import { StudentContent } from "@/data/get-student-content";
import { getSubmissionByContentId } from "../action";
import type { SubmissionResult } from "./learning-dialog";

interface LibraryTabsProps {
  content: StudentContent[];
}

export function LibraryTabs({ content }: LibraryTabsProps) {
  const [selectedContent, setSelectedContent] = React.useState<StudentContent | null>(
    null
  );
  const [isLearningDialogOpen, setIsLearningDialogOpen] = React.useState(false);
  const [existingResults, setExistingResults] = React.useState<SubmissionResult | null>(null);
  const [submissionMap, setSubmissionMap] = React.useState<Map<string, SubmissionResult>>(new Map());

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

  // Load submissions for all content types on mount
  React.useEffect(() => {
    const loadSubmissions = async () => {
      // Check submissions for all content types that can be submitted
      const submittableContentTypes = [
        "assessment",
        "quiz",
        "lesson_plan",
        "worksheet",
        "presentation",
      ];
      
      const submittableItems = content.filter((item) =>
        submittableContentTypes.includes(item.contentType)
      );
      
      const submissions = new Map<string, SubmissionResult>();
      
      for (const item of submittableItems) {
        try {
          const submission = await getSubmissionByContentId(item.id);
          if (submission) {
            submissions.set(item.id, submission);
          }
        } catch (error) {
          console.error(`Error loading submission for ${item.id}:`, error);
        }
      }
      
      setSubmissionMap(submissions);
    };
    
    loadSubmissions();
  }, [content]);

  const handleStartLearning = async (item: StudentContent) => {
    setSelectedContent(item);
    
    // Check if there's an existing submission for any content type
    const existingSubmission = submissionMap.get(item.id);
    if (existingSubmission) {
      setExistingResults(existingSubmission);
    } else {
      // Try to fetch it if not in map
      try {
        const submission = await getSubmissionByContentId(item.id);
        if (submission) {
          setExistingResults(submission);
          setSubmissionMap((prev) => {
            const newMap = new Map(prev);
            newMap.set(item.id, submission);
            return newMap;
          });
        } else {
          setExistingResults(null);
        }
      } catch (error) {
        console.error("Error fetching submission:", error);
        setExistingResults(null);
      }
    }
    
    setIsLearningDialogOpen(true);
  };

  const handleCloseLearningDialog = () => {
    setIsLearningDialogOpen(false);
    setSelectedContent(null);
    setExistingResults(null);
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
            <LearningLibraryCard
              key={item.id}
              id={item.id}
              title={item.title}
              imageUrl={imageUrl}
              imageAlt={item.title}
              contentType={item.contentType}
              grade={item.grade}
              subject={item.subject}
              topic={item.topic}
              date={item.createdAt}
              onStartLearning={() => handleStartLearning(item)}
              hasSubmission={submissionMap.has(item.id)}
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

      <LearningDialog
        content={selectedContent}
        open={isLearningDialogOpen}
        onClose={handleCloseLearningDialog}
        initialResults={existingResults}
      />
    </>
  );
}
