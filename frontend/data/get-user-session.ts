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

    if (!session?.user?.id) {
      return null;
    }

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

    if (!user) {
      return null;
    }

    return {
      ...session,
      user: {
        ...session.user,
        role: user.role,
      },
    };
  } catch (error) {
    return null;
  }
}
