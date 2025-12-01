import { ClassTabs } from "./_components/class-tabs";
import { getStudentData } from "@/data/get-student-data";
import { requireTeacher } from "@/data/get-teacher";

export default async function ClassGroupingPage() {
  await requireTeacher();
  const students = await getStudentData();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Class Grouping</h1>
        <p className="text-muted-foreground mt-2">
          Manage and view your students, their performance, and feedback
        </p>
      </div>
      <ClassTabs students={students} />
    </div>
  );
}