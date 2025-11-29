import prisma from "@/lib/prisma";

export type UserWithDetails = {
  id: string;
  name: string;
  email: string;
  role: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  grade?: string | null;
  subjects?: string | null;
  gradeId?: string | null;
  subjectIds?: string[];
};

/**
 * Fetches all users from the database with SSR.
 * This function is used for server-side rendering to improve performance.
 * 
 * @param roleFilter - Optional filter by role (admin, teacher, student)
 * @param searchQuery - Optional search query to filter by name or email
 * @returns Array of users with their details
 */
export async function getAllUsers(
  roleFilter?: string,
  searchQuery?: string
): Promise<UserWithDetails[]> {
  try {
    const where: any = {};

    // Filter by role if provided
    if (roleFilter && roleFilter !== "all") {
      where.role = roleFilter;
    }

    // Search by name or email if provided
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { email: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        gradeId: true,
        grade: {
          select: {
            id: true,
            name: true,
          },
        },
        userSubjects: {
          select: {
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Map users with grade and subjects
    return users.map((user) => ({
      ...user,
      grade: user.grade?.name || null,
      subjects: user.userSubjects.map((us) => us.subject.name).join(", ") || null,
      gradeId: user.gradeId,
      subjectIds: user.userSubjects.map((us) => us.subject.id),
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

