"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getStudentContent } from "./get-student-content";

export interface CompletedAssessment {
  id: string;
  contentId: string;
  title: string;
  contentType: string;
  score: number;
  submittedAt: Date;
  hasFeedback: boolean;
}

export async function getCompletedAssessments(): Promise<CompletedAssessment[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    // Get all content and submissions
    const [content, submissions] = await Promise.all([
      getStudentContent(),
      prisma.studentSubmission.findMany({
        where: { userId: session.user.id },
        select: {
          contentId: true,
          score: true,
          submittedAt: true,
        },
      }),
    ]);

    // Get existing feedbacks
    const feedbacks = await prisma.studentFeedback.findMany({
      where: { userId: session.user.id },
      select: {
        contentId: true,
      },
    });

    const feedbackContentIds = new Set(feedbacks.map((f) => f.contentId));
    const completedIds = new Set(submissions.map((s) => s.contentId));

    // Filter only assessments/quizzes that are completed
    const completedAssessments: CompletedAssessment[] = [];

    for (const item of content) {
      if (
        completedIds.has(item.id) &&
        (item.contentType === "assessment" ||
          item.contentType === "quiz" ||
          item.contentType === "worksheet")
      ) {
        const submission = submissions.find((s) => s.contentId === item.id);
        if (submission) {
          completedAssessments.push({
            id: item.id,
            contentId: item.id,
            title: item.title,
            contentType: item.contentType,
            score: Number(submission.score),
            submittedAt: submission.submittedAt,
            hasFeedback: feedbackContentIds.has(item.id),
          });
        }
      }
    }

    // Sort by most recent submission
    return completedAssessments.sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  } catch (error) {
    console.error("Error fetching completed assessments:", error);
    return [];
  }
}

