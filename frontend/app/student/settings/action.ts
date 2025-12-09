"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateStudentName(name: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    // Verify user is a student
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || user.role !== "student") {
      throw new Error("Unauthorized");
    }

    // Update the name
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name },
    });

    revalidatePath("/student/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating student name:", error);
    throw new Error("Failed to update name");
  }
}

