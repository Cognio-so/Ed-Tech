"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  title: string;
  type: string;
  dueDate?: Date;
  grade?: number;
  maxGrade?: number;
  status: "completed" | "upcoming" | "pending";
}

interface AssignmentsTableProps {
  assignments: Assignment[];
}

export function AssignmentsTable({ assignments }: AssignmentsTableProps) {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today, ${format(date, "h:mm a")}`;
    if (diffDays === 1) return `Tomorrow, ${format(date, "h:mm a")}`;
    if (diffDays === -1) return `Yesterday, ${format(date, "h:mm a")}`;
    return format(date, "d MMM, h:mm a");
  };

  const getStatusBadge = (status: string, grade?: number, maxGrade?: number) => {
    if (status === "completed" && grade !== undefined) {
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 border-green-500/20"
        >
          {grade}/{maxGrade || 200}
        </Badge>
      );
    }
    if (status === "upcoming") {
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
          Upcoming
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
        Final grade
      </Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="h-full"
    >
      <Card className="border-2 h-full flex flex-col">
        <CardHeader>
          <CardTitle>My Assignments</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    TASK
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    GRADE
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                    UPDATE
                  </th>
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground">
                      No assignments available
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {assignment.dueDate ? (
                            <>
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {formatDate(assignment.dueDate)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">
                              {assignment.type}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(assignment.status, assignment.grade, assignment.maxGrade)}
                    </td>
                    <td className="py-4 px-4">
                      {assignment.status === "completed" ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-muted-foreground">Completed</span>
                        </div>
                      ) : assignment.status === "upcoming" ? (
                        <span className="text-sm text-muted-foreground">Upcoming</span>
                      ) : (
                        <span className="text-sm font-medium">Final grade</span>
                      )}
                    </td>
                  </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

