"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function saveContent(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const contentType = formData.get("contentType") as string;
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const grade = formData.get("grade") as string;
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[];
    const subject = formData.get("subject") as string;
    const topic = formData.get("topic") as string;
    const language = formData.get("language") as string;
    const learningObjective = formData.get("learningObjective") as string;
    const emotionalConsideration = parseInt(
      formData.get("emotionalConsideration") as string
    );
    const adaptiveLearning = formData.get("adaptiveLearning") === "true";
    const includeAssessment = formData.get("includeAssessment") === "true";
    const multimediaSuggestion =
      formData.get("multimediaSuggestion") === "true";
    const instructionDepth = formData.get("instructionDepth") as string;
    const numberOfSessions = formData.get("numberOfSessions") as string;
    const durationOfSession = formData.get("durationOfSession") as string;

    await prisma.content.create({
      data: {
        userId: session.user.id,
        contentType,
        title,
        content,
        grade: gradeIds.length > 0 ? gradeIds.join(", ") : grade,
        subject,
        topic,
        language,
        learningObjective,
        emotionalConsideration,
        adaptiveLearning,
        includeAssessment,
        multimediaSuggestion,
        instructionDepth,
        numberOfSessions,
        durationOfSession,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving content:", error);
    throw new Error("Failed to save content");
  }
}

export async function deleteContent(contentId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    // Check ownership
    const content = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      throw new Error("Content not found");
    }

    if (content.userId !== session.user.id) {
      throw new Error("Forbidden");
    }

    await prisma.content.delete({
      where: { id: contentId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting content:", error);
    throw new Error("Failed to delete content");
  }
}

export async function updateContent(contentId: string, formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    // Check ownership
    const existing = await prisma.content.findUnique({
      where: { id: contentId },
    });

    if (!existing) {
      throw new Error("Content not found");
    }

    if (existing.userId !== session.user.id) {
      throw new Error("Forbidden");
    }

    const contentType = formData.get("contentType") as string;
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const grade = formData.get("grade") as string;
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[];
    const subject = formData.get("subject") as string;
    const topic = formData.get("topic") as string;
    const language = formData.get("language") as string;
    const learningObjective = formData.get("learningObjective") as string;
    const emotionalConsideration = parseInt(
      formData.get("emotionalConsideration") as string
    );
    const adaptiveLearning = formData.get("adaptiveLearning") === "true";
    const includeAssessment = formData.get("includeAssessment") === "true";
    const multimediaSuggestion =
      formData.get("multimediaSuggestion") === "true";
    const instructionDepth = formData.get("instructionDepth") as string;
    const numberOfSessions = formData.get("numberOfSessions") as string;
    const durationOfSession = formData.get("durationOfSession") as string;

    await prisma.content.update({
      where: { id: contentId },
      data: {
        contentType,
        title,
        content,
        grade: gradeIds.length > 0 ? gradeIds.join(", ") : grade,
        subject,
        topic,
        language,
        learningObjective,
        emotionalConsideration,
        adaptiveLearning,
        includeAssessment,
        multimediaSuggestion,
        instructionDepth,
        numberOfSessions,
        durationOfSession,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating content:", error);
    throw new Error("Failed to update content");
  }
}
