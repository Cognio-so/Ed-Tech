"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  CheckCircle, 
  PlayCircle, 
  Bookmark,
  Target,
  Clock,
  Award
} from "lucide-react";

// Progress Character Component (same as in page.jsx)
const ProgressCharacter = () => (
  <div className="hidden lg:block absolute right-4 top-4">
    <div className="relative w-24 h-24">
      <div className="absolute inset-0 text-5xl" style={{ animation: 'gentle-bounce 4s ease-in-out infinite' }}>��</div>
      <div className="absolute -top-2 -right-2 text-xl" style={{ animation: 'gentle-spin 6s linear infinite' }}>⭐</div>
      <div className="absolute -top-6 right-2 text-lg" style={{ animation: 'gentle-pulse 3s ease-in-out infinite' }}>✨</div>
      <style jsx>{`
        @keyframes gentle-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes gentle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gentle-pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  </div>
);

// Loading Card Component
const LoadingCard = () => (
  <Card className="border-0 rounded-2xl shadow-md bg-white dark:bg-gray-800 overflow-hidden h-full">
    {/* Header with gradient background */}
    <div className="relative h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
      <Skeleton className="w-12 h-12 rounded-full bg-white/50" />
      <div className="absolute right-2 top-2">
        <Skeleton className="w-16 h-6 rounded-full bg-white/50" />
      </div>
      <div className="absolute bottom-2 left-2">
        <Skeleton className="w-12 h-5 rounded-full bg-white/50" />
      </div>
      <div className="absolute top-2 left-2">
        <Skeleton className="w-8 h-8 rounded-full bg-white/50" />
      </div>
    </div>
    
    <CardContent className="p-4 h-full flex flex-col">
      <div className="space-y-3 flex-1">
        {/* Title and description */}
        <div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        
        {/* Time and score */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
      
      {/* Buttons */}
      <div className="mt-3 space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-8 w-full rounded-xl" />
      </div>
    </CardContent>
  </Card>
);

export default function MyLearningLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 relative">
        <ProgressCharacter />
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <Skeleton className="h-10 w-96 mx-auto mb-2" />
          <Skeleton className="h-6 w-2/3 mx-auto" />
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <Skeleton className="h-8 w-48 mx-auto" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="text-center p-4 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                    <Skeleton className="h-8 w-8 mx-auto mb-2 rounded-full" />
                    <Skeleton className="h-8 w-12 mx-auto mb-2" />
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Tabs */}
        <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <Skeleton className="h-8 w-48 mx-auto" />
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList className="grid w-full grid-cols-4 rounded-2xl bg-gray-100 dark:bg-gray-700 p-1">
                <TabsTrigger value="all" className="rounded-xl" disabled>
                  <Sparkles className="mr-1 h-4 w-4" /> All Content
                </TabsTrigger>
                <TabsTrigger value="completed" className="rounded-xl" disabled>
                  <CheckCircle className="mr-1 h-4 w-4" /> Completed
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="rounded-xl" disabled>
                  <PlayCircle className="mr-1 h-4 w-4" /> In Progress
                </TabsTrigger>
                <TabsTrigger value="bookmarked" className="rounded-xl" disabled>
                  <Bookmark className="mr-1 h-4 w-4" /> Bookmarked
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                <ScrollArea className="h-[600px]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <LoadingCard key={index} />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
