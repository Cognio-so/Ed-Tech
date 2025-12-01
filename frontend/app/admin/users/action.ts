"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  try {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const gradeId = formData.get("gradeId") as string | null;
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[];
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
        userGrades: {
          create: gradeIds.map((gradeId) => ({
            id: crypto.randomUUID(),
            gradeId,
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
    const gradeIds = JSON.parse(
      (formData.get("gradeIds") as string) || "[]"
    ) as string[];
    const subjectIds = JSON.parse(
      (formData.get("subjectIds") as string) || "[]"
    ) as string[];

    await Promise.all([
      prisma.userSubject.deleteMany({
        where: { userId },
      }),
      prisma.userGrade.deleteMany({
        where: { userId },
      }),
    ]);

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        role,
        gradeId: gradeId || (gradeIds.length > 0 ? gradeIds[0] : null),
        userSubjects: {
          create: subjectIds.map((subjectId) => ({
            id: crypto.randomUUID(),
            subjectId,
          })),
        },
        userGrades: {
          create: gradeIds.map((gradeId) => ({
            id: crypto.randomUUID(),
            gradeId,
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

const SUBJECTS = [
  "mathematics",
  "english",
  "hindi",
  "social_science",
  "science",
  "biology",
  "physics",
  "chemistry",
  "computer_science",
  "history",
  "geography",
  "sanskrit",
  "physical_education",
  "art",
  "the_world_around_us",
  "urdu",
];

const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export async function initializeSubjectsAndGrades() {
  try {
    const [existingSubjectsCount, existingGradesCount] = await Promise.all([
      prisma.subject.count(),
      prisma.grade.count(),
    ]);

    const needsSubjectsInit = existingSubjectsCount < SUBJECTS.length;
    const needsGradesInit = existingGradesCount < GRADES.length;

    if (!needsSubjectsInit && !needsGradesInit) {
      return { success: true, initialized: false };
    }

    const subjectPromises = needsSubjectsInit
      ? SUBJECTS.map((subjectName) =>
          prisma.subject.upsert({
            where: { name: subjectName },
            update: {},
            create: {
              id: crypto.randomUUID(),
              name: subjectName,
            },
          })
        )
      : [];

    const gradePromises = needsGradesInit
      ? GRADES.map((gradeName) =>
          prisma.grade.upsert({
            where: { name: gradeName },
            update: {},
            create: {
              id: crypto.randomUUID(),
              name: gradeName,
            },
          })
        )
      : [];

    await Promise.all([...subjectPromises, ...gradePromises]);

    return { success: true, initialized: true };
  } catch (error) {
    console.error("Error initializing subjects and grades:", error);
    return { success: false, initialized: false };
  }
}
