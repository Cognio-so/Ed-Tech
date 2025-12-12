"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface ExamData {
  id: string;
  organisationName: string;
  examName: string;
  duration: string;
  grade: string | null;
  subject: string | null;
  language: string | null;
  difficultyLevel: string | null;
  topics: string;
  customPrompt: string | null;
  content: string;
  title: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getExamGenerated(): Promise<ExamData[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const exams = await prisma.exam.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return exams;
  } catch (error) {
    console.error("Error fetching exams:", error);
    return [];
  }
}

