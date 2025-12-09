import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Requires a user to be authenticated.
 * Redirects to login if no session exists.
 * 
 * @returns Object with user session
 */
export async function requireUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  return {
    user: session.user,
    session,
  };
}

