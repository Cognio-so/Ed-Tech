"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function saveMediaContent(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const contentType = formData.get("contentType") as string;
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const metadata = formData.get("metadata") as string;

    switch (contentType) {
      case "slide": {
        const data = {
          userId: session.user.id,
          title,
          content,
          metadata: metadata || null,
        };
        await prisma.slide.create({ data });
        break;
      }
      case "image": {
        // For images, store the Cloudinary URL in both content and url fields
        const data = {
          userId: session.user.id,
          contentType: "image",
          title,
          content, // Keep for backward compatibility
          url: content, // Store Cloudinary URL in dedicated url field
          metadata: metadata || null,
        };
        await prisma.image.create({ data });
        break;
      }
      case "web":
        await prisma.webSearch.create({ data });
        break;
      case "comic":
        await prisma.comic.create({ data });
        break;
      case "video":
        await prisma.video.create({ data });
        break;
      default:
        throw new Error(`Invalid content type: ${contentType}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving media content:", error);
    throw new Error("Failed to save media content");
  }
}

export async function deleteMediaContent(
  contentId: string,
  contentType: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    const mediaTypes = ["slide", "image", "web", "comic", "video"];
    if (!mediaTypes.includes(contentType)) {
      throw new Error("Invalid content type");
    }

    let mediaContent: { userId: string } | null = null;

    switch (contentType) {
      case "slide":
        mediaContent = await prisma.slide.findUnique({
          where: { id: contentId },
        });
        break;
      case "image":
        mediaContent = await prisma.image.findUnique({
          where: { id: contentId },
        });
        break;
      case "web":
        mediaContent = await prisma.webSearch.findUnique({
          where: { id: contentId },
        });
        break;
      case "comic":
        mediaContent = await prisma.comic.findUnique({
          where: { id: contentId },
        });
        break;
      case "video":
        mediaContent = await prisma.video.findUnique({
          where: { id: contentId },
        });
        break;
      default:
        throw new Error(`Invalid content type: ${contentType}`);
    }

    if (!mediaContent) {
      throw new Error("Media content not found");
    }

    if (mediaContent.userId !== session.user.id) {
      throw new Error("Forbidden");
    }

    switch (contentType) {
      case "slide":
        await prisma.slide.delete({ where: { id: contentId } });
        break;
      case "image":
        await prisma.image.delete({ where: { id: contentId } });
        break;
      case "web":
        await prisma.webSearch.delete({ where: { id: contentId } });
        break;
      case "comic":
        await prisma.comic.delete({ where: { id: contentId } });
        break;
      case "video":
        await prisma.video.delete({ where: { id: contentId } });
        break;
    }

    return { success: true };
  } catch (error) {
    console.error("Error deleting media content:", error);
    throw new Error("Failed to delete media content");
  }
}
