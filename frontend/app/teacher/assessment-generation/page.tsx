import { Suspense } from "react"
import { AssessmentTabs } from "./_components/assessment-tabs"
import prisma from "@/lib/prisma"

async function getGrades() {
  try {
    const grades = await prisma.grade.findMany({
      orderBy: { name: "asc" },
    })
    return grades.map((grade) => ({ id: grade.id, name: grade.name }))
  } catch (error) {
    console.error("Error fetching grades:", error)
    return []
  }
}

async function getSubjects() {
  try {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
    })
    return subjects.map((subject) => ({ id: subject.id, name: subject.name }))
  } catch (error) {
    console.error("Error fetching subjects:", error)
    return []
  }
}

export default async function AssessmentGenerationPage() {
  const [grades, subjects] = await Promise.all([
    getGrades(),
    getSubjects(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assessment Generation</h1>
        <p className="text-muted-foreground mt-1">
          Create comprehensive assessments with multiple question types for your students
        </p>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <AssessmentTabs initialGrades={grades} initialSubjects={subjects} />
      </Suspense>
    </div>
  )
}
