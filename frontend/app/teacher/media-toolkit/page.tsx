import { Suspense } from "react"
import { ContentTabs } from "./_components/content-tabs"
import { ContentTabsSkeleton } from "./_components/content-tabs-skeleton"

export default async function MediaToolkitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Media Toolkit</h1>
        <p className="text-muted-foreground mt-1">
          Create slides, images, web content, comics, and videos for your educational materials
        </p>
      </div>
      <Suspense fallback={<ContentTabsSkeleton />}>
        <ContentTabs />
      </Suspense>
    </div>
  )
}

