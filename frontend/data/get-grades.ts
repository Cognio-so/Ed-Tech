import "server-only";
import prisma from "@/lib/prisma";

/**
 * Fetches all grades from the database
 */
export async function getAllGrades() {
  try {
    const grades = await prisma.grade.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });
    return grades;
  } catch (error) {
    console.error("Error fetching grades:", error);
    return [];
  }
}

