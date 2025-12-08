"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface LessonItem {
  id: string;
  content: string;
  durationOfSession?: string | null;
  contentType: string;
  title: string;
}

/**
 * Fetches a lesson item by ID
 * Returns null if not found or user is not authorized
 */
export async function getLessonItemById(
  contentId: string
): Promise<LessonItem | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return null;
    }

    const lessonItem = await prisma.lessonItem.findUnique({
      where: { id: contentId },
      select: {
        id: true,
        content: true,
        durationOfSession: true,
        contentType: true,
        title: true,
      },
    });

    if (!lessonItem) {
      return null;
    }

    return {
      id: lessonItem.id,
      content: lessonItem.content,
      durationOfSession: lessonItem.durationOfSession,
      contentType: lessonItem.contentType,
      title: lessonItem.title,
    };
  } catch (error) {
    console.error("Error fetching lesson item:", error);
    return null;
  }
}

