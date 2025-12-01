"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Edit, Trash2, Copy, Download, Eye } from "lucide-react"
import { toast } from "sonner"
import { deleteAssessment } from "../action"
import { DownloadDialog } from "@/components/ui/download-dialog"
import { AssessmentPreview } from "./assessment-preview"

interface Assessment {
  id: string
  contentType: string
  title: string
  content: string
  grade?: string | null
  subject?: string | null
  topic?: string | null
  createdAt: Date
  updatedAt: Date
}

export function SavedAssessmentsList() {
  const [savedAssessments, setSavedAssessments] = React.useState<Assessment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showDownloadDialog, setShowDownloadDialog] = React.useState(false)
  const [downloadContent, setDownloadContent] = React.useState<{
    content: string
    title: string
  } | null>(null)
  const [previewContent, setPreviewContent] = React.useState<Assessment | null>(null)
  const [showPreview, setShowPreview] = React.useState(false)

  React.useEffect(() => {
    fetchSavedAssessments()
    
    const handleRefresh = () => {
      fetchSavedAssessments()
    }
    
    window.addEventListener("refreshAssessments", handleRefresh)
    return () => {
      window.removeEventListener("refreshAssessments", handleRefresh)
    }
  }, [])

  const fetchSavedAssessments = async () => {
    try {
      const response = await fetch("/api/content")
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          const assessments = data.filter((item: Assessment) => item.contentType === "assessment")
          setSavedAssessments(assessments)
        } else {
          setSavedAssessments([])
        }
      } else {
        setSavedAssessments([])
      }
    } catch (error) {
      console.error("Error fetching assessments:", error)
      setSavedAssessments([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assessment?")) return

    try {
      await deleteAssessment(id)
      toast.success("Assessment deleted successfully")
      setSavedAssessments(savedAssessments.filter((a) => a.id !== id))
    } catch (error) {
      toast.error("Failed to delete assessment")
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Assessment copied to clipboard")
  }

  const handleDownload = (content: string, title: string) => {
    setDownloadContent({ content, title })
    setShowDownloadDialog(true)
  }

  const handleEdit = (assessment: Assessment) => {
    sessionStorage.setItem("editAssessment", JSON.stringify(assessment))
    window.dispatchEvent(new CustomEvent("switchToAssessmentFormTab"))
  }

  const handlePreview = (assessment: Assessment) => {
    setPreviewContent(assessment)
    setShowPreview(true)
  }

  const handlePreviewClose = () => {
    setShowPreview(false)
    setPreviewContent(null)
  }

  const handlePreviewSave = async () => {
    handlePreviewClose()
  }

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
            <div
              key={i}
              className="border rounded-lg p-6 space-y-4"
            >
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
    )
  }

  if (!Array.isArray(savedAssessments) || savedAssessments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No saved assessments yet</p>
        <p className="text-muted-foreground text-sm mt-2">
          Generate and save assessments to see them here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {savedAssessments.map((assessment) => (
          <div
            key={assessment.id}
            className="border rounded-lg p-6 space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">{assessment.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {assessment.topic && (
                    <>
                      <span>{assessment.topic}</span>
                    </>
                  )}
                  {assessment.grade && (
                    <>
                      <span>•</span>
                      <span>Grade {assessment.grade}</span>
                    </>
                  )}
                  {assessment.subject && (
                    <>
                      <span>•</span>
                      <span>{assessment.subject}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(assessment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(assessment)}
                  title="Preview assessment"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(assessment)}
                  title="Edit assessment"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(assessment.content)}
                  title="Copy assessment"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(assessment.content, assessment.title)}
                  title="Download assessment"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(assessment.id)}
                  title="Delete assessment"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Dialog */}
      {showPreview && previewContent && (
        <AssessmentPreview
          content={previewContent.content}
          topic={previewContent.topic || previewContent.title}
          onSave={handlePreviewSave}
          onClose={handlePreviewClose}
        />
      )}

      {/* Download Dialog */}
      {downloadContent && (
        <DownloadDialog
          open={showDownloadDialog}
          onOpenChange={setShowDownloadDialog}
          content={downloadContent.content}
          title={downloadContent.title}
        />
      )}
    </div>
  )
}

