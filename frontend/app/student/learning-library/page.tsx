import { getStudentContent } from "@/data/get-student-content";
import { LibraryTabs } from "./_components/library-tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Suspense } from "react";

export const metadata = {
  title: "Learning Library",
  description: "Browse and access learning content tailored to your grade",
};

async function LearningLibraryContent() {
  const content = await getStudentContent();

  const totalItems = content.length;
  const lastUpdated = content.length > 0 ? content[0].updatedAt : new Date();

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto py-2 px-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-primary">Learning Library</h1>
        <p className="text-muted-foreground">
          Browse and access learning content tailored to your grade
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search content..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total: {totalItems} items</span>
          {totalItems > 0 && (
            <span>Last updated: {formatDate(lastUpdated)}</span>
          )}
        </div>
      </div>

      <LibraryTabs content={content} />
    </div>
  );
}

export default function LearningLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-4 px-4">
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded w-64" />
            <div className="h-4 bg-muted animate-pulse rounded w-96" />
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <LearningLibraryContent />
    </Suspense>
  );
}
