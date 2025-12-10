import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export interface AttendanceData {
  id: string;
  studentId: string;
  student: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  gradeId: string;
  grade: {
    id: string;
    name: string;
  };
  teacherId: string;
  date: Date;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fetches attendance records for a specific date and grade.
 * For teachers, only returns attendance for their assigned grade.
 *
 * @param date - Date to fetch attendance for (YYYY-MM-DD format or Date object)
 * @param gradeId - Optional grade ID to filter by
 * @returns Array of attendance records
 */
export async function getAttendanceByDate(
  date: string | Date,
  gradeId?: string
): Promise<AttendanceData[]> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const dateObj = typeof date === "string" ? new Date(date) : date;
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    const where: any = {
      date: {
        gte: dateObj,
        lt: nextDay,
      },
    };

    // Get user role and grade
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        gradeId: true,
      },
    });

    // For teachers, only show attendance for their grade
    // For admins, show all attendance (or filtered by gradeId if provided)
    if (user?.role === "teacher" && user.gradeId) {
      where.gradeId = user.gradeId;
    } else if (user?.role === "admin" && gradeId) {
      where.gradeId = gradeId;
    } else if (gradeId) {
      where.gradeId = gradeId;
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        grade: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        student: {
          name: "asc",
        },
      },
    });

    return attendances.map((attendance) => ({
      id: attendance.id,
      studentId: attendance.studentId,
      student: attendance.student,
      gradeId: attendance.gradeId,
      grade: attendance.grade,
      teacherId: attendance.teacherId,
      date: attendance.date,
      status: attendance.status,
      notes: attendance.notes,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    }));
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return [];
  }
}

/**
 * Fetches students for a specific grade that don't have attendance marked for a date.
 * Useful for showing which students still need attendance marked.
 *
 * @param gradeId - Grade ID to fetch students for
 * @param date - Date to check attendance for
 * @returns Array of students without attendance records
 */
export async function getStudentsWithoutAttendance(
  gradeId: string,
  date: string | Date
): Promise<Array<{ id: string; name: string; email: string; image: string | null; grade: { name: string } | null }>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return [];
    }

    const dateObj = typeof date === "string" ? new Date(date) : date;
    dateObj.setHours(0, 0, 0, 0);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all students in the grade
    const students = await prisma.user.findMany({
      where: {
        role: "student",
        gradeId: gradeId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        grade: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // Get students who already have attendance marked
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        gradeId: gradeId,
        date: {
          gte: dateObj,
          lt: nextDay,
        },
      },
      select: {
        studentId: true,
      },
    });

    const markedStudentIds = new Set(attendanceRecords.map((a) => a.studentId));

    // Return students without attendance
    return students.filter((student) => !markedStudentIds.has(student.id));
  } catch (error) {
    console.error("Error fetching students without attendance:", error);
    return [];
  }
}

