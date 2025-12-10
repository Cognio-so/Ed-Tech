"use server";

import {
  IconTrendingUp,
  IconUsers,
  IconUserCheck,
  IconSchool,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminStats } from "@/data/get-admin-stats";

export async function SectionCards() {
  const stats = await getAdminStats();

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Users</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {stats.totalUsers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />+{stats.recentUsers}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            All platform users <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {stats.recentUsers} new users this week
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Students</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {stats.totalStudents}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconUsers />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Student accounts <IconUsers className="size-4" />
          </div>
          <div className="text-muted-foreground">Registered students</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Teachers</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {stats.totalTeachers}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconUserCheck />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Teacher accounts <IconUserCheck className="size-4" />
          </div>
          <div className="text-muted-foreground">Registered teachers</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Grades</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-primary">
            {stats.totalGrades}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconSchool />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Grade levels <IconSchool className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {stats.totalSubjects} subjects available
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
