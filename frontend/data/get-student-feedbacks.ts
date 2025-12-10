"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface StudentFeedbackData {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentImage: string | null;
  contentId: string;
  contentType: string;
  title: string;
  feedback: string;
  rating: number | null;
  createdAt: Date;
  grade: string | null;
}

export async function getStudentFeedbacks(
  page: number = 1,
  pageSize: number = 10
): Promise<{
  feedbacks: StudentFeedbackData[];
  total: number;
  totalPages: number;
}> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return { feedbacks: [], total: 0, totalPages: 0 };
    }

    // Get the teacher's grade
    const teacher = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        gradeId: true,
      },
    });

    if (!teacher || teacher.role !== "teacher" || !teacher.gradeId) {
      return { feedbacks: [], total: 0, totalPages: 0 };
    }

    const skip = (page - 1) * pageSize;

    // Get all feedbacks from students in the same grade
    const [feedbacks, total] = await Promise.all([
      prisma.studentFeedback.findMany({
        where: {
          user: {
            role: "student",
            gradeId: teacher.gradeId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              grade: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
      }),
      prisma.studentFeedback.count({
        where: {
          user: {
            role: "student",
            gradeId: teacher.gradeId,
          },
        },
      }),
    ]);

    const feedbacksData: StudentFeedbackData[] = feedbacks.map((feedback) => ({
      id: feedback.id,
      studentId: feedback.userId,
      studentName: feedback.user.name,
      studentEmail: feedback.user.email,
      studentImage: feedback.user.image,
      contentId: feedback.contentId,
      contentType: feedback.contentType,
      title: feedback.title,
      feedback: feedback.feedback,
      rating: feedback.rating,
      createdAt: feedback.createdAt,
      grade: feedback.user.grade?.name || null,
    }));

    return {
      feedbacks: feedbacksData,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    console.error("Error fetching student feedbacks:", error);
    return { feedbacks: [], total: 0, totalPages: 0 };
  }
}

