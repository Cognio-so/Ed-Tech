"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Trash2, Copy, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { deleteExam } from "../action";
import { DownloadDialog } from "@/components/ui/download-dialog";
import { ExamFormPreview } from "./exam-form-preview";
import { getExamGenerated, type ExamData } from "@/data/get-exam-generated";

export function SavedExamsList() {
  const [savedExams, setSavedExams] = React.useState<ExamData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false);
  const [downloadContent, setDownloadContent] = React.useState<{
    content: string;
    title: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = React.useState<ExamData | null>(
    null
  );
  const [showPreview, setShowPreview] = React.useState(false);

  React.useEffect(() => {
    fetchSavedExams();

    const handleRefresh = () => {
      fetchSavedExams();
    };

    window.addEventListener("refreshExams", handleRefresh);
    return () => {
      window.removeEventListener("refreshExams", handleRefresh);
    };
  }, []);

  const fetchSavedExams = async () => {
    try {
      const exams = await getExamGenerated();
      setSavedExams(exams);
    } catch (error) {
      console.error("Error fetching exams:", error);
      setSavedExams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this exam?")) return;

    try {
      await deleteExam(id);
      toast.success("Exam deleted successfully");
      setSavedExams(savedExams.filter((e) => e.id !== id));
    } catch (error) {
      toast.error("Failed to delete exam");
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Exam copied to clipboard");
  };

  const handleDownload = (content: string, title: string) => {
    setDownloadContent({ content, title });
    setShowDownloadDialog(true);
  };

  const handleEdit = (exam: ExamData) => {
    sessionStorage.setItem("editExam", JSON.stringify(exam));
    window.dispatchEvent(new CustomEvent("switchToExamFormTab"));
  };

  const handlePreview = (exam: ExamData) => {
    setPreviewContent(exam);
    setShowPreview(true);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setPreviewContent(null);
  };

  const handlePreviewSave = async () => {
    handlePreviewClose();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <div className="flex flex-wrap items-center gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/50 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!Array.isArray(savedExams) || savedExams.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No saved exams yet</p>
        <p className="text-muted-foreground text-sm mt-2">
          Generate and save exams to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {savedExams.map((exam) => (
          <div
            key={exam.id}
            className="border rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{exam.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {exam.examName && (
                    <>
                      <span>{exam.examName}</span>
                    </>
                  )}
                  {exam.grade && (
                    <>
                      <span>•</span>
                      <span>Grade {exam.grade}</span>
                    </>
                  )}
                  {exam.subject && (
                    <>
                      <span>•</span>
                      <span>{exam.subject}</span>
                    </>
                  )}
                  {exam.organisationName && (
                    <>
                      <span>•</span>
                      <span>{exam.organisationName}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(exam.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(exam)}
                  title="Preview exam"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(exam)}
                  title="Edit exam"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(exam.content)}
                  title="Copy exam"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(exam.content, exam.title)}
                  title="Download exam"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(exam.id)}
                  title="Delete exam"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPreview && previewContent && (
        <ExamFormPreview
          content={previewContent.content}
          title={previewContent.title}
          onSave={handlePreviewSave}
          onClose={handlePreviewClose}
        />
      )}

      {downloadContent && (
        <DownloadDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          content={downloadContent.content}
          title={downloadContent.title}
        />
      )}
    </div>
  );
}

