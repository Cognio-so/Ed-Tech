"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";

interface Assignment {
  title: string;
  type: string;
  score?: number;
  submittedAt?: Date;
  due?: string;
}

interface AssignmentsPreviewProps {
  pending: Assignment[];
  completed: Assignment[];
}

export function AssignmentsPreview({
  pending,
  completed,
}: AssignmentsPreviewProps) {
  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      assessment: "bg-red-500/10 text-red-600 border-red-500/20",
      quiz: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      worksheet: "bg-green-500/10 text-green-600 border-green-500/20",
      homework: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      lesson_plan: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    };
    return colors[type] || "bg-gray-500/10 text-gray-600 border-gray-500/20";
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="h-full border-2 bg-gradient-to-br from-background to-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Pending Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length > 0 ? (
              <>
                {pending.slice(0, 3).map((assignment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold text-sm line-clamp-1">
                          {assignment.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize border ${getTypeColor(assignment.type)}`}
                          >
                            {assignment.type}
                          </Badge>
                          {assignment.due && (
                            <span className="text-xs text-muted-foreground">
                              Due: {assignment.due}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {pending.length > 3 && (
                  <Link href="/student/learning-library">
                    <Button variant="outline" className="w-full" size="sm">
                      View All ({pending.length})
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No pending assignments</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="h-full border-2 bg-gradient-to-br from-background to-muted/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Recent Completions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completed.length > 0 ? (
              <>
                {completed.slice(0, 3).map((assignment, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    className="p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold text-sm line-clamp-1">
                          {assignment.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize border ${getTypeColor(assignment.type)}`}
                          >
                            {assignment.type}
                          </Badge>
                          {assignment.score !== undefined && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                assignment.score >= 90
                                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                                  : assignment.score >= 70
                                  ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                  : "bg-red-500/10 text-red-600 border-red-500/20"
                              }`}
                            >
                              {assignment.score}%
                            </Badge>
                          )}
                          {assignment.submittedAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(assignment.submittedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {completed.length > 3 && (
                  <Link href="/student/history">
                    <Button variant="outline" className="w-full" size="sm">
                      View All ({completed.length})
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No completed assignments yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

