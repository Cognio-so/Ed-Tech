"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StudentData } from "@/data/get-student-data";
import { TrendingUp, User, Mail, GraduationCap } from "lucide-react";

interface PerformanceListProps {
  students: StudentData[];
}

export function PerformanceList({ students }: PerformanceListProps) {
  // Filter students who have performance data
  const studentsWithPerformance = students.filter((student) => student.performance);

  if (studentsWithPerformance.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-2">
            Performance data is not available yet.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            This feature will be added soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Performance</h2>
          <p className="text-muted-foreground">
            Performance data for {studentsWithPerformance.length} student(s)
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {studentsWithPerformance.map((student) => (
          <Card key={student.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={student.image || undefined} alt={student.name} />
                  <AvatarFallback>
                    {student.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{student.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 mt-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{student.email}</span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {student.grade && (
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Grade:</span>
                  <Badge variant="secondary">{student.grade}</Badge>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Performance: </span>
                <Badge variant="outline" className="font-medium">
                  {student.performance}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {students.filter((s) => !s.performance).length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground text-center">
              Performance data not available for{" "}
              {students.filter((s) => !s.performance).length} student(s)
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

