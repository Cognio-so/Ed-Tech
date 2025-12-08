"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function addToLesson(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || user.role !== "teacher") {
    throw new Error("Only teachers can add content to lessons");
  }

  try {
    const contentType = formData.get("contentType") as string;
    const contentId = formData.get("contentId") as string;
    const lessonId = formData.get("lessonId") as string | null;
    const lessonName = formData.get("lessonName") as string | null;

    if (!contentType || !contentId) {
      throw new Error("Content type and content ID are required");
    }

    let lesson;
    
    // Get or create lesson
    if (lessonId) {
      lesson = await prisma.lesson.findUnique({
        where: { id: lessonId, userId: session.user.id },
      });
      if (!lesson) {
        throw new Error("Lesson not found");
      }
    } else {
      if (!lessonName) {
        throw new Error("Lesson name is required when creating a new lesson");
      }
      // Check if a lesson with the same name already exists for this user
      const existingLesson = await prisma.lesson.findFirst({
        where: {
          userId: session.user.id,
          lessonName: lessonName.trim(),
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingLesson) {
        lesson = existingLesson;
      } else {
        lesson = await prisma.lesson.create({
          data: {
            userId: session.user.id,
            lessonName: lessonName.trim(),
            lessonDescription: null,
          },
        });
      }
    }

    // Fetch the original content based on contentType
    let originalContent: any = null;
    let lessonItemData: any = {
      lessonId: lesson.id,
      contentType,
      contentId,
      title: "",
      content: "",
      order: 0,
    };

    switch (contentType) {
      case "assessment":
      case "lesson_plan":
      case "presentation":
      case "quiz":
      case "worksheet": {
        originalContent = await prisma.content.findUnique({
          where: { id: contentId },
        });
        if (!originalContent || originalContent.userId !== session.user.id) {
          throw new Error("Content not found or unauthorized");
        }
        lessonItemData = {
          ...lessonItemData,
          title: originalContent.title,
          content: originalContent.content,
          grade: originalContent.grade,
          subject: originalContent.subject,
          topic: originalContent.topic,
          language: originalContent.language,
          learningObjective: originalContent.learningObjective,
          difficultyLevel: originalContent.instructionDepth,
          instructionDepth: originalContent.instructionDepth,
          numberOfSessions: originalContent.numberOfSessions,
          durationOfSession: originalContent.durationOfSession,
        };
        // For assessments, extract correct answers and solutions from content
        if (contentType === "assessment") {
          // Parse assessment content to extract answers (this is a simplified version)
          // The actual parsing would depend on the assessment format
          const assessmentMetadata = originalContent.numberOfSessions
            ? JSON.parse(originalContent.numberOfSessions)
            : {};
          lessonItemData.metadata = JSON.stringify(assessmentMetadata);
        }
        break;
      }
      case "slide": {
        originalContent = await prisma.slide.findUnique({
          where: { id: contentId },
        });
        if (!originalContent || originalContent.userId !== session.user.id) {
          throw new Error("Content not found or unauthorized");
        }
        let parsedContent: any = {};
        try {
          parsedContent = JSON.parse(originalContent.content);
        } catch {}
        lessonItemData = {
          ...lessonItemData,
          title: originalContent.title,
          content: originalContent.content,
          presentationUrl: parsedContent.presentation_url || null,
          metadata: originalContent.metadata,
        };
        break;
      }
      case "image": {
        originalContent = await prisma.image.findUnique({
          where: { id: contentId },
        });
        if (!originalContent || originalContent.userId !== session.user.id) {
          throw new Error("Content not found or unauthorized");
        }
        // Use url field if available (new format), otherwise fallback to content field
        const imageUrl = (originalContent as any).url || originalContent.content;
        lessonItemData = {
          ...lessonItemData,
          title: originalContent.title,
          content: imageUrl, // Store the Cloudinary URL in content
          imageUrl: imageUrl, // Also store in imageUrl field for easy access
          metadata: originalContent.metadata,
        };
        break;
      }
      case "video": {
        originalContent = await prisma.video.findUnique({
          where: { id: contentId },
        });
        if (!originalContent || originalContent.userId !== session.user.id) {
          throw new Error("Content not found or unauthorized");
        }
        let parsedContent: any = {};
        try {
          parsedContent = JSON.parse(originalContent.content);
        } catch {}
        lessonItemData = {
          ...lessonItemData,
          title: originalContent.title,
          content: originalContent.content,
          videoUrl: parsedContent.video_url || parsedContent.url || null,
          metadata: originalContent.metadata,
        };
        break;
      }
      default:
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    // Check if content is already added to this lesson
    // This check must happen before creating the lesson item
    const existingLessonItem = await prisma.lessonItem.findFirst({
      where: {
        lessonId: lesson.id,
        contentType: contentType.trim(),
        contentId: contentId.trim(),
      },
    });

    if (existingLessonItem) {
      console.log("Duplicate detected:", { 
        lessonId: lesson.id, 
        lessonName: lesson.lessonName,
        contentType, 
        contentId, 
        existingId: existingLessonItem.id 
      });
      throw new Error("Content already added to lesson");
    }

    const maxOrder = await prisma.lessonItem.findFirst({
      where: { lessonId: lesson.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    lessonItemData.order = (maxOrder?.order ?? -1) + 1;

    // Create the lesson item
    await prisma.lessonItem.create({
      data: lessonItemData,
    });

    return { success: true, lessonId: lesson.id };
  } catch (error) {
    console.error("Error adding content to lesson:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to add content to lesson"
    );
  }
}

export async function removeFromLesson(lessonItemId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check if user is a teacher
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || user.role !== "teacher") {
    throw new Error("Only teachers can remove content from lessons");
  }

  try {
    // Find the lesson item and verify ownership
    const lessonItem = await prisma.lessonItem.findUnique({
      where: { id: lessonItemId },
      include: { lesson: true },
    });

    if (!lessonItem) {
      throw new Error("Lesson item not found");
    }

    if (lessonItem.lesson.userId !== session.user.id) {
      throw new Error("Unauthorized");
    }

    // Delete the lesson item
    await prisma.lessonItem.delete({
      where: { id: lessonItemId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error removing content from lesson:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to remove content from lesson"
    );
  }
}
