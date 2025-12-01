"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"

export async function saveAssessment(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    redirect("/login")
  }

  try {
    const title = formData.get("title") as string
    const content = formData.get("content") as string
    const grade = formData.get("grade") as string
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[]
    const subject = formData.get("subject") as string
    const topic = formData.get("topic") as string
    const language = formData.get("language") as string
    const learningObjective = formData.get("learningObjective") as string
    const difficultyLevel = formData.get("difficultyLevel") as string
    const duration = formData.get("duration") as string
    const confidenceLevel = parseInt(
      formData.get("confidenceLevel") as string
    )
    const customInstruction = formData.get("customInstruction") as string
    const mcqEnabled = formData.get("mcqEnabled") === "true"
    const mcqCount = parseInt(formData.get("mcqCount") as string) || 0
    const trueFalseEnabled = formData.get("trueFalseEnabled") === "true"
    const trueFalseCount = parseInt(formData.get("trueFalseCount") as string) || 0
    const shortAnswerEnabled = formData.get("shortAnswerEnabled") === "true"
    const shortAnswerCount = parseInt(formData.get("shortAnswerCount") as string) || 0

    await prisma.content.create({
      data: {
        userId: session.user.id,
        contentType: "assessment",
        title,
        content,
        grade: gradeIds.length > 0 ? gradeIds.join(", ") : grade,
        subject,
        topic,
        language,
        learningObjective,
        instructionDepth: difficultyLevel,
        durationOfSession: duration,
        emotionalConsideration: confidenceLevel,
        numberOfSessions: JSON.stringify({
          customInstruction,
          mcqEnabled,
          mcqCount,
          trueFalseEnabled,
          trueFalseCount,
          shortAnswerEnabled,
          shortAnswerCount,
        }),
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Error saving assessment:", error)
    throw new Error("Failed to save assessment")
  }
}

export async function deleteAssessment(assessmentId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    redirect("/login")
  }

  try {
    const assessment = await prisma.content.findUnique({
      where: { id: assessmentId },
    })

    if (!assessment) {
      throw new Error("Assessment not found")
    }

    if (assessment.userId !== session.user.id) {
      throw new Error("Forbidden")
    }

    if (assessment.contentType !== "assessment") {
      throw new Error("Invalid content type")
    }

    await prisma.content.delete({
      where: { id: assessmentId },
    })

    return { success: true }
  } catch (error) {
    console.error("Error deleting assessment:", error)
    throw new Error("Failed to delete assessment")
  }
}

export async function updateAssessment(assessmentId: string, formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    redirect("/login")
  }

  try {
    const existing = await prisma.content.findUnique({
      where: { id: assessmentId },
    })

    if (!existing) {
      throw new Error("Assessment not found")
    }

    if (existing.userId !== session.user.id) {
      throw new Error("Forbidden")
    }

    if (existing.contentType !== "assessment") {
      throw new Error("Invalid content type")
    }

    const title = formData.get("title") as string
    const content = formData.get("content") as string
    const grade = formData.get("grade") as string
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[]
    const subject = formData.get("subject") as string
    const topic = formData.get("topic") as string
    const language = formData.get("language") as string
    const learningObjective = formData.get("learningObjective") as string
    const difficultyLevel = formData.get("difficultyLevel") as string
    const duration = formData.get("duration") as string
    const confidenceLevel = parseInt(
      formData.get("confidenceLevel") as string
    )
    const customInstruction = formData.get("customInstruction") as string
    const mcqEnabled = formData.get("mcqEnabled") === "true"
    const mcqCount = parseInt(formData.get("mcqCount") as string) || 0
    const trueFalseEnabled = formData.get("trueFalseEnabled") === "true"
    const trueFalseCount = parseInt(formData.get("trueFalseCount") as string) || 0
    const shortAnswerEnabled = formData.get("shortAnswerEnabled") === "true"
    const shortAnswerCount = parseInt(formData.get("shortAnswerCount") as string) || 0

    await prisma.content.update({
      where: { id: assessmentId },
      data: {
        title,
        content,
        grade: gradeIds.length > 0 ? gradeIds.join(", ") : grade,
        subject,
        topic,
        language,
        learningObjective,
        instructionDepth: difficultyLevel,
        durationOfSession: duration,
        emotionalConsideration: confidenceLevel,
        numberOfSessions: JSON.stringify({
          customInstruction,
          mcqEnabled,
          mcqCount,
          trueFalseEnabled,
          trueFalseCount,
          shortAnswerEnabled,
          shortAnswerCount,
        }),
      },
    })

    return { success: true }
  } catch (error) {
    console.error("Error updating assessment:", error)
    throw new Error("Failed to update assessment")
  }
}

