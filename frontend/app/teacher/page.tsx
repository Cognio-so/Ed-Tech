import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { DataTable } from "./_components/data-table";
import { SectionCards } from "./_components/section-cards";
import { Suspense } from "react";
import {
  SectionCardsSkeleton,
  ChartSkeleton,
  DataTableSkeleton,
} from "./_components/loading-skeletons";
import { getLibraryContent } from "@/data/get-library-content";

async function ChartContent() {
  const data = await getLibraryContent();
  return <ChartAreaInteractive data={data} />;
}

async function TableContent() {
  const data = await getLibraryContent();
  return <DataTable data={data} />;
}

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome to your teaching workspace
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
              <ChartContent />
            </Suspense>
          </div>

          <Suspense fallback={<DataTableSkeleton />}>
            <TableContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
