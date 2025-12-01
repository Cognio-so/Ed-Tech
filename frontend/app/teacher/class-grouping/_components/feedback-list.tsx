"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StudentData } from "@/data/get-student-data";
import { MessageSquare, User, Mail, Calendar } from "lucide-react";
import { format } from "date-fns";

interface FeedbackListProps {
  students: StudentData[];
}

export function FeedbackList({ students }: FeedbackListProps) {
  // Filter students who have feedback
  const studentsWithFeedback = students.filter((student) => student.feedback);

  if (studentsWithFeedback.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No feedback has been shared by students yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Feedbacks</h2>
          <p className="text-muted-foreground">
            {studentsWithFeedback.length}{" "}
            {studentsWithFeedback.length === 1 ? "feedback" : "feedbacks"} received
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {studentsWithFeedback.map((student) => (
          <Card key={student.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-4">
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
                  <CardTitle className="text-lg">{student.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{student.email}</span>
                    {student.grade && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <Badge variant="secondary" className="text-xs">
                          {student.grade}
                        </Badge>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-primary mt-1" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Feedback:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {student.feedback}
                    </p>
                  </div>
                </div>
                {student.createdAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Received on {format(new Date(student.createdAt), "MMM dd, yyyy")}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {students.filter((s) => !s.feedback).length > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground text-center">
              {students.filter((s) => !s.feedback).length} student(s) haven't shared feedback yet
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

