'use server'

import { IconTrendingUp, IconFileText, IconClipboardList, IconPhoto } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getLibraryContent } from "@/data/get-library-content"

export async function SectionCards() {
  const content = await getLibraryContent()
  
  // Calculate statistics
  const contentGenerationCount = content.filter(item => item.type === 'content-generation').length
  const assessmentCount = content.filter(item => item.type === 'assessment').length
  const mediaToolkitCount = content.filter(item => item.type === 'media-toolkit').length
  const totalCount = content.length

  // Calculate recent activity (items created in last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentContent = content.filter(item => new Date(item.createdAt) >= sevenDaysAgo).length

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Content</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconTrendingUp />
              {recentContent} new
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            All your created content <IconTrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {recentContent} items created this week
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Content Generation</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {contentGenerationCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconFileText />
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Lesson plans & materials <IconFileText className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Generated content items
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Assessments</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {assessmentCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconClipboardList />
              Ready
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Assessment materials <IconClipboardList className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Created assessments
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Media Toolkit</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {mediaToolkitCount}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <IconPhoto />
              Available
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Media resources <IconPhoto className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Images, slides, videos & more
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

