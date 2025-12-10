import { SectionCards } from "@/components/sidebar/section-cards";
import { Suspense } from "react";
import { SectionCardsSkeleton } from "./_components/loading-skeletons";
import { UsersServer } from "@/app/admin/users/_components/users-server";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
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
            <div className="rounded-lg border bg-card">
              <div className="p-6">
                <h2 className="text-2xl font-bold tracking-tight mb-4">
                  Recent Users
                </h2>
                <Suspense
                  fallback={<div className="p-4">Loading users...</div>}
                >
                  <UsersServer roleFilter="all" searchQuery="" />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
