'use server';

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface StudentContent {
  id: string;
  contentType: string;
  title: string;
  content: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  language?: string | null;
  learningObjective?: string | null;
  difficultyLevel?: string | null;
  duration?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  presentationUrl?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getStudentContent(): Promise<StudentContent[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        gradeId: true,
        userGrades: {
          select: {
            grade: {
              select: {
                name: true,
              },
            },
          },
        },
        grade: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user || user.role !== "student") {
      return [];
    }

    const gradeNames: string[] = [];

    if (user.grade?.name) {
      gradeNames.push(user.grade.name);
    }

    user.userGrades.forEach((userGrade) => {
      if (userGrade.grade.name && !gradeNames.includes(userGrade.grade.name)) {
        gradeNames.push(userGrade.grade.name);
      }
    });

    if (gradeNames.length === 0) {
      return [];
    }

    // Fetch lesson items that match the student's grades
    // Also include items where grade is null (for content like images that might not have a grade)
    const lessonItems = await prisma.lessonItem.findMany({
      where: {
        OR: [
          {
            grade: {
              in: gradeNames,
            },
          },
          {
            grade: null,
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return lessonItems.map((item) => ({
      id: item.id,
      contentType: item.contentType,
      title: item.title,
      content: item.content,
      grade: item.grade,
      subject: item.subject,
      topic: item.topic,
      language: item.language,
      learningObjective: item.learningObjective,
      difficultyLevel: item.difficultyLevel,
      duration: item.duration,
      imageUrl: item.imageUrl,
      videoUrl: item.videoUrl,
      presentationUrl: item.presentationUrl,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  } catch (error) {
    return [];
  }
}
