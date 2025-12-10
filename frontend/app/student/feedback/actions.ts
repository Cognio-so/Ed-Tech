"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function submitFeedback(
  contentId: string,
  title: string,
  contentType: string,
  feedback: string,
  rating?: number
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if feedback already exists
    const existingFeedback = await prisma.studentFeedback.findFirst({
      where: {
        userId: session.user.id,
        contentId: contentId,
      },
    });

    if (existingFeedback) {
      // Update existing feedback
      await prisma.studentFeedback.update({
        where: { id: existingFeedback.id },
        data: {
          title,
          contentType,
          feedback,
          rating: rating || null,
        },
      });
    } else {
      // Create new feedback
      await prisma.studentFeedback.create({
        data: {
          userId: session.user.id,
          contentId,
          title,
          contentType,
          feedback,
          rating: rating || null,
        },
      });
    }

    revalidatePath("/student/feedback");
    revalidatePath("/teacher/class-grouping");

    return { success: true };
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return { success: false, error: "Failed to submit feedback" };
  }
}

