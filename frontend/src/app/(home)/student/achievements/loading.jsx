import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-gray-900 dark:via-yellow-900 dark:to-red-900">
      <div className="container mx-auto px-4 py-8 relative">
        {/* Achievement Character Skeleton */}
        <div className="hidden lg:block absolute right-4 top-4">
          <Skeleton className="w-24 h-24 rounded-full" />
        </div>
        
        {/* Header Skeleton */}
        <div className="text-center mb-8">
          <Skeleton className="h-12 w-96 mx-auto mb-4" />
          <Skeleton className="h-6 w-2xl mx-auto" />
        </div>

        {/* Stats Overview Skeleton */}
        <div className="mb-8">
          <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="text-center p-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800/30 dark:to-gray-700/30">
                    <Skeleton className="h-8 w-8 mx-auto mb-2 rounded-full" />
                    <Skeleton className="h-8 w-16 mx-auto mb-2" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Tabs Skeleton */}
        <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <Skeleton className="h-8 w-64 mx-auto" />
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="earned" className="space-y-4">
              <TabsList className="grid w-full grid-cols-8 rounded-2xl bg-gray-100 dark:bg-gray-700 p-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <TabsTrigger key={i} value={`tab-${i}`} className="rounded-xl">
                    <Skeleton className="h-4 w-16" />
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Card key={i} className="border-0 rounded-2xl shadow-lg overflow-hidden">
                      <div className="relative h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                        <Skeleton className="h-16 w-16 rounded-full" />
                      </div>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <Skeleton className="h-6 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3 mt-1" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
