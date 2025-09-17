'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

const LibraryLoadingSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
    <div className="container mx-auto px-4 py-8 relative">
      {/* Character placeholder */}
      <div className="hidden lg:block absolute right-4 top-4">
        <Skeleton className="w-24 h-24 rounded-full" />
      </div>
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <Skeleton className="h-12 w-96 mx-auto mb-4" />
        <Skeleton className="h-6 w-[600px] mx-auto" />
      </motion.div>

      {/* Search and Filter Card */}
      <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm mb-8">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-80" />
            </div>
            <div className="relative w-full sm:w-64">
              <Skeleton className="w-full h-10 rounded-xl" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <div className="space-y-6">
        <div className="flex flex-wrap justify-start gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-20 rounded-xl" />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="border-0 rounded-2xl shadow-md bg-white dark:bg-gray-800 overflow-hidden h-full">
                {/* Card Header with gradient */}
                <div className="relative h-32 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="absolute right-2 top-2">
                    <Skeleton className="w-16 h-6 rounded-full" />
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <Skeleton className="w-12 h-5 rounded-full" />
                  </div>
                </div>
                
                <CardContent className="p-4 h-full flex flex-col">
                  <div className="space-y-3 flex-1">
                    {/* Title and description */}
                    <div>
                      <Skeleton className="h-5 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-10" />
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
                  
                  {/* Button */}
                  <div className="mt-3">
                    <Skeleton className="w-full h-10 rounded-xl" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mt-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 rounded-3xl shadow-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 overflow-hidden">
                <CardContent className="p-6 text-center">
                  <Skeleton className="w-12 h-12 mx-auto mb-3 rounded-full" />
                  <Skeleton className="h-6 w-16 mx-auto mb-1" />
                  <Skeleton className="h-4 w-24 mx-auto" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

export default LibraryLoadingSkeleton
