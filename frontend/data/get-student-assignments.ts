'use server';

import { getStudentContent } from "./get-student-content";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export async function getStudentAssignments() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { pending: [], completed: [] };
    }

    // Fetch content and submissions in parallel
    const [content, submissions] = await Promise.all([
      getStudentContent(),
      prisma.studentSubmission.findMany({
        where: { userId: session.user.id },
        select: {
          contentId: true,
          score: true,
          submittedAt: true
        }
      })
    ]);

    const completedIds = new Set(submissions.map(s => s.contentId));
    
    const pending: Array<Record<string, any>> = [];
    const completed: Array<Record<string, any>> = [];

    for (const item of content) {
      if (completedIds.has(item.id)) {
        completed.push({
          title: item.title,
          type: item.contentType,
          score: submissions.find(s => s.contentId === item.id)?.score,
          submittedAt: submissions.find(s => s.contentId === item.id)?.submittedAt
        });
      } else {
        // Only count as pending if it's something that can be "completed"
        // e.g. quiz, assessment, worksheet. Images/Videos might be just for viewing.
        // For now, including everything not submitted as pending, or maybe refine logic.
        // User said "pass actual completed assessment and pending one properly".
        // Let's assume assessment, quiz, worksheet, lesson_plan are assignable.
        const assignableTypes = ['assessment', 'quiz', 'worksheet', 'lesson_plan', 'homework'];
        
        if (assignableTypes.includes(item.contentType) || item.contentType === 'assignment') {
             pending.push({
              title: item.title,
              type: item.contentType,
              due: "Soon" 
            });
        }
      }
    }

    return { pending, completed };
  } catch (error) {
    console.error("Error fetching student assignments:", error);
    return { pending: [], completed: [] };
  }
}

