"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import type { CompletedAssessment } from "@/data/get-completed-assessments";
import { FeedbackDialog } from "./feedback-dialog";

interface CompletedAssessmentsListProps {
  assessments: CompletedAssessment[];
}

export function CompletedAssessmentsList({
  assessments: initialAssessments,
}: CompletedAssessmentsListProps) {
  const [assessments, setAssessments] = useState<CompletedAssessment[]>(initialAssessments);
  const [selectedAssessment, setSelectedAssessment] =
    useState<CompletedAssessment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Update assessments when initialAssessments changes (from router.refresh())
  useEffect(() => {
    setAssessments(initialAssessments);
  }, [initialAssessments]);

  const handleFeedbackClick = (assessment: CompletedAssessment) => {
    setSelectedAssessment(assessment);
    setIsDialogOpen(true);
  };

  const handleFeedbackSuccess = () => {
    // Optimistically update the assessment to show feedback has been given
    setAssessments((prev) =>
      prev.map((assessment) =>
        assessment.id === selectedAssessment?.id
          ? { ...assessment, hasFeedback: true }
          : assessment
      )
    );
  };

  if (assessments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center mb-2">
            No completed assessments found.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Complete assessments to provide feedback.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {assessments.map((assessment) => (
          <Card
            key={assessment.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate mb-2">
                    {assessment.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {assessment.contentType}
                    </Badge>
                    <Badge
                      variant={
                        assessment.score >= 80
                          ? "default"
                          : assessment.score >= 60
                          ? "secondary"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {Math.floor(assessment.score)}%
                    </Badge>
                    {assessment.hasFeedback && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Feedback Given
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <p>Submitted: {format(assessment.submittedAt, "MMM dd, yyyy")}</p>
              </div>
              <Button
                onClick={() => handleFeedbackClick(assessment)}
                className="w-full"
                variant={assessment.hasFeedback ? "outline" : "default"}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {assessment.hasFeedback ? "Update Feedback" : "Give Feedback"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAssessment && (
        <FeedbackDialog
          assessment={selectedAssessment}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSuccess={handleFeedbackSuccess}
        />
      )}
    </>
  );
}

