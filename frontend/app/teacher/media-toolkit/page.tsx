import { Suspense } from "react"
import { ContentTabs } from "./_components/content-tabs"
import { ContentTabsSkeleton } from "./_components/content-tabs-skeleton"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import prisma from "@/lib/prisma"

async function getTeacherGradesAndSubjects(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        grade: true,
        userSubjects: {
          include: {
            subject: true,
          },
        },
      },
    })

    const grades = user?.grade ? [{ id: user.grade.id, name: user.grade.name }] : []
    const subjects = user?.userSubjects
      ? user.userSubjects.map((us) => ({
          id: us.subject.id,
          name: us.subject.name,
        }))
      : []

    return { grades, subjects }
  } catch (error) {
    console.error("Error fetching teacher grades and subjects:", error)
    return { grades: [], subjects: [] }
  }
}

export default async function MediaToolkitPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const { grades, subjects } = session?.user?.id
    ? await getTeacherGradesAndSubjects(session.user.id)
    : { grades: [], subjects: [] }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Media Toolkit</h1>
        <p className="text-muted-foreground mt-1">
          Create slides, images, web content, comics, and videos for your educational materials
        </p>
      </div>
      <Suspense fallback={<ContentTabsSkeleton />}>
        <ContentTabs initialGrades={grades} initialSubjects={subjects} />
      </Suspense>
    </div>
  )
}

