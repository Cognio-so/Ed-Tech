import { Suspense } from "react";
import { getCompletedAssessments } from "@/data/get-completed-assessments";
import { CompletedAssessmentsList } from "./_components/completed-assessments-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireStudent } from "@/data/get-student";

function AssessmentsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}

async function FeedbackContent() {
  const assessments = await getCompletedAssessments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Share your feedback on completed assessments to help improve the learning experience.
        </p>
      </div>

      <CompletedAssessmentsList assessments={assessments} />
    </div>
  );
}

export default async function FeedbackPage() {
  await requireStudent();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Suspense fallback={<AssessmentsSkeleton />}>
        <FeedbackContent />
      </Suspense>
    </div>
  );
}

