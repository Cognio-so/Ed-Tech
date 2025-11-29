import { ChartAreaInteractive } from "@/components/sidebar/chart-area-interactive"
import { DataTable } from "@/components/sidebar/data-table"
import { SectionCards } from "@/components/sidebar/section-cards"
import { Suspense } from "react"
import {
  SectionCardsSkeleton,
  ChartSkeleton,
  DataTableSkeleton,
} from "./_components/loading-skeletons"

import data from "./data.json"

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to the Admin Dashboard
          </p>
        </div>
      </div>

      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <Suspense fallback={<SectionCardsSkeleton />}>
            <SectionCards />
          </Suspense>
          
          <div className="px-4 lg:px-6">
            <Suspense fallback={<ChartSkeleton />}>
              <ChartAreaInteractive />
            </Suspense>
          </div>
          
          <Suspense fallback={<DataTableSkeleton />}>
            <DataTable data={data} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
