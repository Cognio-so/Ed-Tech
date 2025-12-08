"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface LibraryContent {
  id: string;
  type: "media-toolkit" | "content-generation" | "assessment";
  contentType: string;
  title: string;
  content: string;
  grade?: string | null;
  subject?: string | null;
  topic?: string | null;
  language?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function getLibraryContent(): Promise<LibraryContent[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const userId = session.user.id;

    const [contentItems, slides, images, webSearches, comics, videos] =
      await Promise.all([
        prisma.content.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.slide.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.image.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.webSearch.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.comic.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.video.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const transformedContent = contentItems.map((item) => ({
      id: item.id,
      type:
        item.contentType === "assessment"
          ? ("assessment" as const)
          : ("content-generation" as const),
      contentType: item.contentType,
      title: item.title,
      content: item.content,
      grade: item.grade,
      subject: item.subject,
      topic: item.topic,
      language: item.language,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const transformedSlides = slides.map((item) => ({
      id: item.id,
      type: "media-toolkit" as const,
      contentType: "slide",
      title: item.title,
      content: item.content,
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const transformedImages = images.map((item) => ({
      id: item.id,
      type: "media-toolkit" as const,
      contentType: (item as any).contentType || "image",
      title: item.title,
      content: (item as any).url || item.content, // Use url field if available, fallback to content
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const transformedWebSearches = webSearches.map((item) => ({
      id: item.id,
      type: "media-toolkit" as const,
      contentType: "web",
      title: item.title,
      content: item.content,
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const transformedComics = comics.map((item) => ({
      id: item.id,
      type: "media-toolkit" as const,
      contentType: "comic",
      title: item.title,
      content: item.content,
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const transformedVideos = videos.map((item) => ({
      id: item.id,
      type: "media-toolkit" as const,
      contentType: "video",
      title: item.title,
      content: item.content,
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    const allContent = [
      ...transformedContent,
      ...transformedSlides,
      ...transformedImages,
      ...transformedWebSearches,
      ...transformedComics,
      ...transformedVideos,
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return allContent;
  } catch (error) {
    return [];
  }
}
