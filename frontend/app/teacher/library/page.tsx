import { getLibraryContent } from "@/data/get-library-content"
import { AllTabs } from "./_components/all-tabs"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { Suspense } from "react"

export const metadata = {
  title: "My Library",
  description: "Manage and organize all your created content in one place",
}

async function LibraryContent() {
  const content = await getLibraryContent()

  // Calculate summary stats
  const totalItems = content.length
  const lastUpdated = content.length > 0 
    ? content[0].updatedAt 
    : new Date()

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">My Library</h1>
        <p className="text-muted-foreground">
          Manage and organize all your created content in one place
        </p>
      </div>

      {/* Search and Summary */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search your content..."
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

      {/* Tabs and Content */}
      <AllTabs content={content} />
    </div>
  )
}

export default function LibraryPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto py-4 px-4">
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-64" />
          <div className="h-4 bg-muted animate-pulse rounded w-96" />
          <div className="h-12 bg-muted animate-pulse rounded" />
        </div>
      </div>
    }>
      <LibraryContent />
    </Suspense>
  )
}
