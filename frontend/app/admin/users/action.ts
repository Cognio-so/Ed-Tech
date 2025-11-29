"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const gradeId = formData.get("gradeId") as string | null;
    const subjectIds = JSON.parse(
      (formData.get("subjectIds") as string) || "[]"
    ) as string[];

    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name,
        email,
        role,
        gradeId: gradeId || null,
        userSubjects: {
          create: subjectIds.map((subjectId) => ({
            id: crypto.randomUUID(),
            subjectId,
          })),
        },
      },
    });

    revalidatePath("/admin/users");
    return { success: true, user };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error("Failed to create user");
  }
}

export async function deleteUser(userId: string) {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new Error("Failed to delete user");
  }
}

export async function updateUser(userId: string, formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const gradeId = formData.get("gradeId") as string | null;
    const subjectIds = JSON.parse(
      (formData.get("subjectIds") as string) || "[]"
    ) as string[];

    // Delete existing user subjects
    await prisma.userSubject.deleteMany({
      where: { userId },
    });

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role,
        gradeId: gradeId || null,
        userSubjects: {
          create: subjectIds.map((subjectId) => ({
            id: crypto.randomUUID(),
            subjectId,
          })),
        },
      },
    });

    revalidatePath("/admin/users");
    return { success: true, user };
  } catch (error) {
    console.error("Error updating user:", error);
    throw new Error("Failed to update user");
  }
}

export async function createGrade(name: string) {
  try {
    const grade = await prisma.grade.create({
      data: {
        id: crypto.randomUUID(),
        name,
      },
    });
    revalidatePath("/admin/users");
    return { success: true, grade };
  } catch (error) {
    console.error("Error creating grade:", error);
    throw new Error("Failed to create grade");
  }
}

export async function deleteGrade(gradeId: string) {
  try {
    await prisma.grade.delete({
      where: { id: gradeId },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting grade:", error);
    throw new Error("Failed to delete grade");
  }
}

export async function createSubject(name: string) {
  try {
    const subject = await prisma.subject.create({
      data: {
        id: crypto.randomUUID(),
        name,
      },
    });
    revalidatePath("/admin/users");
    return { success: true, subject };
  } catch (error) {
    console.error("Error creating subject:", error);
    throw new Error("Failed to create subject");
  }
}

export async function deleteSubject(subjectId: string) {
  try {
    await prisma.subject.delete({
      where: { id: subjectId },
    });
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("Error deleting subject:", error);
    throw new Error("Failed to delete subject");
  }
}

