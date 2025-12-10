import { getStudentStats } from "@/data/get-student-achievements";
import * as React from "react";
import { Suspense } from "react";
import { getStudentData } from "@/data/get-student";
import { DashboardHeader } from "./_components/dashboard-header";
import { ProfileCard } from "./_components/profile-card";
import { TodaysCourse } from "./_components/todays-course";
import { YourClasses } from "./_components/your-classes";
import { DashboardCards } from "./_components/dashboard-cards";
import { LearningActivityChart } from "./_components/performance-chart";
import { ClientMotionWrapper } from "./_components/client-motion-wrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

function DashboardSkeleton() {
  return (
    <div className="p-6 lg:p-10 space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <Skeleton className="h-[400px] w-full rounded-2xl" />
          <Skeleton className="h-[200px] w-full rounded-2xl" />
        </div>
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-[280px] w-full rounded-2xl" />
    <div className="space-y-6">
              <Skeleton className="h-[130px] w-full rounded-2xl" />
              <Skeleton className="h-[130px] w-full rounded-2xl" />
          </div>
          </div>
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  const [studentData, stats] = await Promise.all([
    getStudentData(),
    getStudentStats(),
  ]);

  if (!studentData) {
    redirect("/login");
  }

  // Use real data where possible, with fallbacks for UI
  const courses = studentData.subjects.slice(0, 2).map((subject, index) => ({
    id: subject.id,
    title: subject.name,
    lessons: Math.floor(Math.random() * 20) + 10, // Mock data
    assignments: Math.floor(Math.random() * 5) + 1, // Mock data
    duration: `${Math.floor(Math.random() * 30) + 30} min`, // Mock data
    students: Math.floor(Math.random() * 200) + 100, // Mock data
    progress: Math.floor(Math.random() * 40) + 60, // Mock data
    icon: index % 2 === 0 ? "🧬" : "🎨", // Mock icon
    color: index % 2 === 0 ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600",
  }));

  const classes = studentData.subjects.slice(0, 1).map(subject => ({
    id: subject.id,
    title: subject.name,
    lessons: 10,
    assignments: 2,
    duration: "45 min",
    students: 256,
    image: "🦠",
  }));

  // Calculate achievements count properly
  let achievementsCount = 0;
  if (stats?.achievement?.unlockedTiers) {
    try {
      const unlockedTiers = JSON.parse(stats.achievement.unlockedTiers);
      achievementsCount = Array.isArray(unlockedTiers) ? unlockedTiers.length : 0;
    } catch {
      achievementsCount = 0;
    }
  }

  return (
    <ClientMotionWrapper>
      <div className="p-6 lg:p-8">
      <DashboardHeader name={studentData.name} />
          </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 lg:px-8 pb-6 min-h-0">
        {/* Left Column - 40% */}
        <div className="lg:col-span-5 space-y-8 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TodaysCourse courses={courses} />
          <YourClasses classes={classes} />
        </div>

        {/* Right Column - 60% */}
        <div className="lg:col-span-7 space-y-8 flex flex-col min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
            <div className="h-full">
          <ProfileCard
            name={studentData.name}
            image={studentData.image}
                grade={studentData.grade?.name}
                achievements={achievementsCount}
          />
            </div>
            <div className="h-full">
              <DashboardCards totalScore={stats?.achievement?.totalScore} />
            </div>
          </div>
          
          <div className="flex-1 min-h-[350px]">
            <LearningActivityChart />
          </div>
        </div>
      </div>
    </ClientMotionWrapper>
  );
}

export default function StudentPage() {
  return (
    <div className="h-full bg-[#F5F5F7] dark:bg-[#0D0D0F] text-slate-900 dark:text-white font-sans overflow-hidden">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
