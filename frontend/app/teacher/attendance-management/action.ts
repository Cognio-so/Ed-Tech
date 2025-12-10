"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requireTeacher } from "@/data/get-teacher";
import { revalidatePath } from "next/cache";
import { getAttendanceByDate } from "@/data/get-attendance";

interface AttendanceRecord {
  studentId: string;
  gradeId: string;
  status: "present" | "absent";
  notes?: string;
}

export async function markAttendance(
  date: string,
  attendances: AttendanceRecord[]
) {
  await requireTeacher();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    redirect("/login");
  }

  try {
    if (!date || !attendances || !Array.isArray(attendances)) {
      throw new Error("Invalid request data");
    }

    // Parse the date
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    // Verify teacher has access to the grade
    const teacher = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        gradeId: true,
      },
    });

    if (!teacher || teacher.role !== "teacher") {
      throw new Error("Only teachers can mark attendance");
    }

    // Process attendance records
    const results = await Promise.all(
      attendances.map(async (record) => {
        // Verify the grade belongs to the teacher
        if (teacher.gradeId && record.gradeId !== teacher.gradeId) {
          throw new Error("Teacher can only mark attendance for their assigned grade");
        }

        // Check if attendance record already exists
        const existing = await prisma.attendance.findFirst({
          where: {
            studentId: record.studentId,
            date: dateObj,
          },
        });

        if (existing) {
          // Update existing record
          return prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              notes: record.notes || null,
              teacherId: session.user.id,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new record
          return prisma.attendance.create({
            data: {
              studentId: record.studentId,
              gradeId: record.gradeId,
              teacherId: session.user.id,
              date: dateObj,
              status: record.status,
              notes: record.notes || null,
            },
          });
        }
      })
    );

    revalidatePath("/teacher/attendance-management");
    return { success: true, count: results.length };
  } catch (error: any) {
    console.error("Error marking attendance:", error);
    throw new Error(error.message || "Failed to mark attendance");
  }
}

export async function getAttendance(date: string, gradeId?: string) {
  await requireTeacher();
  
  try {
    const attendance = await getAttendanceByDate(date, gradeId);
    return { success: true, data: attendance };
  } catch (error: any) {
    console.error("Error fetching attendance:", error);
    return { success: false, data: [], error: error.message };
  }
}

