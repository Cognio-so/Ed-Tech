import { requireTeacher } from "@/data/get-teacher";
import { getStudentData } from "@/data/get-student-data";
import { AttendanceForm } from "./_components/attendance-form";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

async function getTeacherGrade() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  const teacher = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      gradeId: true,
      grade: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return teacher?.gradeId || null;
}

export default async function AttendanceManagementPage() {
  await requireTeacher();
  const students = await getStudentData();
  const gradeId = await getTeacherGrade();

  if (!gradeId) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive mb-2">
            No Grade Assigned
          </h1>
          <p className="text-muted-foreground">
            Please contact an administrator to assign a grade to your account.
          </p>
        </div>
      </div>
    );
  }

  // Transform student data to match the form's expected format
  const studentsForForm = students.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email,
    image: student.image,
    grade: student.grade
      ? {
          id: gradeId,
          name: student.grade,
        }
      : null,
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          Attendance Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Mark daily attendance for your students
        </p>
      </div>
      <AttendanceForm students={studentsForForm} gradeId={gradeId} />
    </div>
  );
}
