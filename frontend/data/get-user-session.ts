import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

/**
 * Fetches the user session with role information.
 * Better Auth doesn't include custom fields like 'role' in the session by default,
 * so we fetch it from the database.
 * 
 * @returns Session object with user role, or null if no session exists
 */
export async function getUserSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    // If no session or user ID, return null
    if (!session?.user?.id) {
      return null;
    }

    // Fetch user with role from database since Better Auth doesn't include custom fields in session
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        emailVerified: true,
      },
    });

    // If user not found in database, return null
    if (!user) {
      return null;
    }

    // Return session with role included
    return {
      ...session,
      user: {
        ...session.user,
        role: user.role,
      },
    };
  } catch (error) {
    console.error("Error fetching user session:", error);
    return null;
  }
}

