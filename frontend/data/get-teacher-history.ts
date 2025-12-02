import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export interface TeacherConversation {
  id: string;
  title: string;
  messages: string;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getTeacherHistory(
  page: number = 1,
  pageSize: number = 10,
  searchQuery?: string
): Promise<{
  conversations: TeacherConversation[];
  total: number;
  totalPages: number;
}> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const skip = (page - 1) * pageSize;

    let whereClause: any = {
      userId: session.user.id,
    };

    if (searchQuery && searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase().trim();
      const allConversations = await (
        prisma as any
      ).teacherConversation.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
          title: true,
          messages: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const filtered = allConversations.filter((conv: any) => {
        const titleMatch = conv.title?.toLowerCase().includes(searchLower);

        let contentMatch = false;
        try {
          const messages = JSON.parse(conv.messages || "[]");
          const allContent = messages
            .map((msg: any) => msg.content || "")
            .join(" ")
            .toLowerCase();
          contentMatch = allContent.includes(searchLower);
        } catch {
          contentMatch = false;
        }

        return titleMatch || contentMatch;
      });

      const sorted = filtered.sort(
        (a: any, b: any) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const paginated = sorted.slice(skip, skip + pageSize);

      return {
        conversations: paginated.map((conv: any) => ({
          ...conv,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        })),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / pageSize),
      };
    }

    const [conversations, total] = await Promise.all([
      (prisma as any).teacherConversation.findMany({
        where: whereClause,
        orderBy: {
          updatedAt: "desc",
        },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          messages: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      (prisma as any).teacherConversation.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      conversations: conversations.map((conv: any) => ({
        ...conv,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      total,
      totalPages,
    };
  } catch (error) {
    return {
      conversations: [],
      total: 0,
      totalPages: 0,
    };
  }
}

export async function getConversationById(
  conversationId: string
): Promise<TeacherConversation | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const conversation = await (prisma as any).teacherConversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
      },
      select: {
        id: true,
        title: true,
        messages: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      ...conversation,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  } catch (error) {
    return null;
  }
}
