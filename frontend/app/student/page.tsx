import { Suspense } from "react";
import { getStudentData } from "@/data/get-student";
import { getStudentStats } from "@/data/get-student-achievements";
import { getStudentAssignments } from "@/data/get-student-assignments";
import { DashboardHeader } from "./_components/dashboard-header";
import { ProfileCard } from "./_components/profile-card";
import { OverviewStats } from "./_components/overview-stats";
import { ActivelyHours } from "./_components/actively-hours";
import { PerformanceChart } from "./_components/performance-chart";
import { AssignmentsTable } from "./_components/assignments-table";
import { CalendarEvents } from "./_components/calendar-events";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-96" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const [studentData, stats, assignments] = await Promise.all([
    getStudentData(),
    getStudentStats(),
    getStudentAssignments(),
  ]);

  if (!studentData) {
    redirect("/login");
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Unable to load dashboard data</p>
      </div>
    );
  }

  const { achievement, stats: studentStats } = stats;

  const completedCount = assignments.completed.length;
  const pendingCount = assignments.pending.length;
  const certificatesEarned = Math.floor(completedCount / 3);

  const assignmentsTableData = [
    ...assignments.completed.slice(0, 3).map((a) => ({
      title: a.title,
      type: a.type,
      dueDate: a.submittedAt ? new Date(a.submittedAt) : undefined,
      grade: a.score,
      maxGrade: 200,
      status: "completed" as const,
    })),
    ...assignments.pending.slice(0, 2).map((a) => ({
      title: a.title,
      type: a.type,
      dueDate: undefined,
      status: "upcoming" as const,
    })),
  ];

  const timeSpent = {
    hours: Math.floor(studentStats.averageScore * 0.3),
    percentage: Math.min(Math.floor((studentStats.averageScore / 100) * 100), 100),
  };

  const lessonsTaken = {
    count: studentStats.totalSubmissions,
    percentage: Math.min(Math.floor((studentStats.totalSubmissions / 100) * 100), 100),
  };

  const examsPassed = {
    count: studentStats.perfectScores,
    percentage: studentStats.perfectScores > 0 ? 100 : 0,
  };

  const productivityPercentage = Math.min(
    Math.floor(((studentStats.averageScore - 60) / 40) * 100),
    100
  );

  return (
    <div className="space-y-6">
      <DashboardHeader name={studentData.name} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OverviewStats
            totalSubmissions={pendingCount}
            completedAssignments={completedCount}
            certificatesEarned={certificatesEarned}
            communitySupport={0}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivelyHours
              timeSpent={timeSpent}
              lessonsTaken={lessonsTaken}
              examsPassed={examsPassed}
            />
            <PerformanceChart productivityPercentage={productivityPercentage} />
          </div>

          <AssignmentsTable assignments={assignmentsTableData} />
        </div>

        <div className="space-y-6">
          <ProfileCard
            name={studentData.name}
            image={studentData.image}
            role={studentData.grade ? `Grade ${studentData.grade.name}` : "Student"}
          />
          <CalendarEvents />
        </div>
      </div>
    </div>
  );
}

export default function StudentPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
