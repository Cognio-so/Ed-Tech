"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StudentData } from "@/data/get-student-data";
import { User, Mail, GraduationCap, Trophy, AlertCircle, MessageSquare } from "lucide-react";

interface StudentListProps {
  students: StudentData[];
}

export function StudentList({ students }: StudentListProps) {
  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <User className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No students found in your grade.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Students</h2>
          <p className="text-muted-foreground">
            {students.length} {students.length === 1 ? "student" : "students"} in your class
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {students.map((student) => (
          <Card key={student.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
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

              {student.achievements ? (
                <div className="flex items-start gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-muted-foreground">Achievements: </span>
                    <span className="text-foreground">{student.achievements}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  <span>Achievements: Not available</span>
                </div>
              )}

              {student.issues ? (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-muted-foreground">Issues: </span>
                    <span className="text-foreground">{student.issues}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Issues: None reported</span>
                </div>
              )}

              {student.performance ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Performance: </span>
                  <Badge variant="outline">{student.performance}</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Performance: Not available</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

