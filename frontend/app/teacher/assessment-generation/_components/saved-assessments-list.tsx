"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Response } from "@/components/ui/response"
import { Edit, Trash2, Copy, Download } from "lucide-react"
import { toast } from "sonner"
import { deleteAssessment } from "../action"

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
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              line-height: 1.6;
            }
            h1, h2, h3 {
              color: #333;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
          </style>
        </head>
        <body>
          <pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title || "assessment"}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Assessment downloaded")
  }

  const handleEdit = (assessment: Assessment) => {
    sessionStorage.setItem("editAssessment", JSON.stringify(assessment))
    window.dispatchEvent(new CustomEvent("switchToAssessmentFormTab"))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading saved assessments...</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Saved Assessments</h2>
          <p className="text-muted-foreground mt-1">
            Manage your saved assessments
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {savedAssessments.length} {savedAssessments.length === 1 ? "assessment" : "assessments"}
        </div>
      </div>

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
            <div className="border rounded-lg p-4 bg-muted/50 max-h-[500px] overflow-y-auto">
              <Response content={assessment.content} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

