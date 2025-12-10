import { requireAdmin } from "@/data/get-admin";
import { AttendanceFilters } from "./_components/attendance-filters";
import { AttendanceTable } from "./_components/attendance-table";
import { getAllGrades } from "@/data/get-grades";
import { Suspense } from "react";
import { format } from "date-fns";

interface ViewAttendancePageProps {
  searchParams: Promise<{
    date?: string;
    gradeId?: string;
  }>;
}

export default async function ViewAttendancePage({ searchParams }: ViewAttendancePageProps) {
  await requireAdmin();
  
  const params = await searchParams;
  const date = params.date || format(new Date(), "yyyy-MM-dd");
  const gradeId = params.gradeId || "all";
  
  // Fetch grades in parallel with the page render
  const grades = await getAllGrades();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">View Attendance</h1>
          <p className="text-muted-foreground">
            View and filter attendance records by date and grade
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <AttendanceFilters
          grades={grades}
          initialDate={new Date(date)}
          initialGradeId={gradeId}
        />

        <Suspense
          key={`${date}-${gradeId}`}
          fallback={
            <div className="rounded-lg border bg-card p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 w-48 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="space-y-2">
                  <div className="h-10 w-full bg-muted rounded" />
                  <div className="h-10 w-full bg-muted rounded" />
                  <div className="h-10 w-full bg-muted rounded" />
                </div>
              </div>
            </div>
          }
        >
          <AttendanceTable
            date={date}
            gradeId={gradeId !== "all" ? gradeId : undefined}
          />
        </Suspense>
      </div>
    </div>
  );
}
