"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function saveExam(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const organisationName = formData.get("organisationName") as string;
    const examName = formData.get("examName") as string;
    const duration = formData.get("duration") as string;
    const grade = formData.get("grade") as string;
    const subject = formData.get("subject") as string;
    const language = formData.get("language") as string;
    const difficultyLevel = formData.get("difficultyLevel") as string;
    const topics = formData.get("topics") as string;
    const customPrompt = formData.get("customPrompt") as string;

    await prisma.exam.create({
      data: {
        userId: session.user.id,
        title,
        content,
        organisationName,
        examName,
        duration,
        grade,
        subject,
        language,
        difficultyLevel,
        topics,
        customPrompt: customPrompt || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving exam:", error);
    throw new Error("Failed to save exam");
  }
}

export async function deleteExam(examId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      throw new Error("Exam not found");
    }

    if (exam.userId !== session.user.id) {
      throw new Error("Forbidden");
    }

    await prisma.exam.delete({
      where: { id: examId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting exam:", error);
    throw new Error("Failed to delete exam");
  }
}

export async function updateExam(examId: string, formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const existing = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!existing) {
      throw new Error("Exam not found");
    }

    if (existing.userId !== session.user.id) {
      throw new Error("Forbidden");
    }

    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const organisationName = formData.get("organisationName") as string;
    const examName = formData.get("examName") as string;
    const duration = formData.get("duration") as string;
    const grade = formData.get("grade") as string;
    const subject = formData.get("subject") as string;
    const language = formData.get("language") as string;
    const difficultyLevel = formData.get("difficultyLevel") as string;
    const topics = formData.get("topics") as string;
    const customPrompt = formData.get("customPrompt") as string;

    await prisma.exam.update({
      where: { id: examId },
      data: {
        title,
        content,
        organisationName,
        examName,
        duration,
        grade,
        subject,
        language,
        difficultyLevel,
        topics,
        customPrompt: customPrompt || null,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating exam:", error);
    throw new Error("Failed to update exam");
  }
}
