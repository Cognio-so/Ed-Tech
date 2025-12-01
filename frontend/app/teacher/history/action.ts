"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function saveConversation(
  messages: string,
  title?: string,
  conversationId?: string,
  sessionId?: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    redirect("/login")
  }

  try {
    const parsedMessages = JSON.parse(messages)
    const firstUserMessage = parsedMessages.find(
      (msg: any) => msg.role === "user"
    )?.content || "New Conversation"

    const conversationTitle = title || firstUserMessage.substring(0, 100)

    if (conversationId) {
      const existing = await (prisma as any).teacherConversation.findUnique({
        where: { id: conversationId },
      })

      if (existing && existing.userId === session.user.id) {
        await (prisma as any).teacherConversation.update({
          where: { id: conversationId },
          data: {
            title: conversationTitle,
            messages,
            metadata: JSON.stringify({
              messageCount: parsedMessages.length,
              sessionId: sessionId || null,
              updatedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          },
        })

        revalidatePath("/teacher/history")
        return { success: true, conversationId }
      }
    }

    if (sessionId) {
      const allConversations = await (prisma as any).teacherConversation.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 50,
      })

      const existingBySession = allConversations.find((conv: any) => {
        if (!conv.metadata) return false
        try {
          const metadata = JSON.parse(conv.metadata)
          return metadata.sessionId === sessionId
        } catch {
          return false
        }
      })

      if (existingBySession) {
        await (prisma as any).teacherConversation.update({
          where: { id: existingBySession.id },
          data: {
            title: conversationTitle,
            messages,
            metadata: JSON.stringify({
              messageCount: parsedMessages.length,
              sessionId: sessionId,
              updatedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          },
        })

        revalidatePath("/teacher/history")
        return { success: true, conversationId: existingBySession.id }
      }
    }

    const newConversation = await (prisma as any).teacherConversation.create({
      data: {
        userId: session.user.id,
        title: conversationTitle,
        messages,
        metadata: JSON.stringify({
          messageCount: parsedMessages.length,
          sessionId: sessionId || null,
          createdAt: new Date().toISOString(),
        }),
      },
    })

    revalidatePath("/teacher/history")
    return { success: true, conversationId: newConversation.id }
  } catch (error) {
    console.error("Error saving conversation:", error)
    throw new Error("Failed to save conversation")
  }
}

export async function deleteConversation(conversationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    redirect("/login")
  }

  try {
    const conversation = await prisma.teacherConversation.findUnique({
      where: { id: conversationId },
    })

    if (!conversation || conversation.userId !== session.user.id) {
      throw new Error("Conversation not found or unauthorized")
    }

    await prisma.teacherConversation.delete({
      where: { id: conversationId },
    })

    revalidatePath("/teacher/history")
    return { success: true }
  } catch (error) {
    console.error("Error deleting conversation:", error)
    throw new Error("Failed to delete conversation")
  }
}