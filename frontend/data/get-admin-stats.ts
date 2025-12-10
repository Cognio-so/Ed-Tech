"use server";

import prisma from "@/lib/prisma";
import type { LibraryContent } from "@/data/get-library-content";

/**
 * Fetches all content across all users for admin dashboard
 */
export async function getAllContent(): Promise<LibraryContent[]> {
  try {
    const [contentItems, slides, images, webSearches, comics, videos] =
      await Promise.all([
        prisma.content.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.slide.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.image.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.webSearch.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.comic.findMany({
          orderBy: { createdAt: "desc" },
        }),
        prisma.video.findMany({
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
      title: item.title || "Untitled Slide",
      content: item.content || "",
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
      contentType: "image",
      title: item.title || "Untitled Image",
      content: item.content || "",
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
      title: item.title || "Untitled Web Search",
      content: item.content || "",
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
      title: item.title || "Untitled Comic",
      content: item.content || "",
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
      title: item.title || "Untitled Video",
      content: item.content || "",
      grade: null,
      subject: null,
      topic: null,
      language: null,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return [
      ...transformedContent,
      ...transformedSlides,
      ...transformedImages,
      ...transformedWebSearches,
      ...transformedComics,
      ...transformedVideos,
    ];
  } catch (error) {
    console.error("Error fetching all content:", error);
    return [];
  }
}

/**
 * Gets admin dashboard statistics
 */
export async function getAdminStats() {
  try {
    const [users, students, teachers, grades, subjects, attendance] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, role: true, createdAt: true },
      }),
      prisma.user.findMany({
        where: { role: "student" },
        select: { id: true },
      }),
      prisma.user.findMany({
        where: { role: "teacher" },
        select: { id: true },
      }),
      prisma.grade.findMany({
        select: { id: true, createdAt: true },
      }),
      prisma.subject.findMany({
        select: { id: true, createdAt: true },
      }),
      prisma.attendance.findMany({
        select: { id: true, createdAt: true },
      }),
    ]);

    const totalUsers = users.length;
    const totalStudents = students.length;
    const totalTeachers = teachers.length;
    const totalGrades = grades.length;
    const totalSubjects = subjects.length;
    const totalAttendance = attendance.length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUsers = users.filter(
      (user) => new Date(user.createdAt) >= sevenDaysAgo
    ).length;

    const recentAttendance = attendance.filter(
      (item) => new Date(item.createdAt) >= sevenDaysAgo
    ).length;

    return {
      totalUsers,
      totalStudents,
      totalTeachers,
      totalGrades,
      totalSubjects,
      totalAttendance,
      recentUsers,
      recentAttendance,
    };
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return {
      totalUsers: 0,
      totalStudents: 0,
      totalTeachers: 0,
      totalGrades: 0,
      totalSubjects: 0,
      totalAttendance: 0,
      recentUsers: 0,
      recentAttendance: 0,
    };
  }
}

