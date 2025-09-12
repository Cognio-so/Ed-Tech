'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Play, FileText, Gamepad2, Film, ExternalLink, Search, Star, Sparkles, BookOpen, Image as ImageIcon, Loader2, RefreshCw, CheckCircle, X, Clock, Users, Bookmark, Share2, Heart, Eye, BarChart3, Award, Target, Zap, Calendar, EyeIcon } from 'lucide-react'
import { toast } from 'sonner'
import { getStudentLessons, getAllStudentContent, getLessonsByType, getLessonsBySubject, searchLessons, getLessonById, updateLessonViewCount, getLessonStats } from './action'
import LearningDialog from '@/components/ui/start-learning'

const gradients = {
  Math: 'from-yellow-300 via-orange-300 to-red-400',
  Science: 'from-green-300 via-blue-300 to-purple-400',
  English: 'from-pink-300 via-purple-300 to-indigo-400',
  History: 'from-amber-300 via-orange-400 to-red-400',
  Art: 'from-purple-300 via-pink-300 to-red-300',
  Geography: 'from-green-400 via-teal-400 to-blue-500',
  Physics: 'from-blue-400 via-indigo-400 to-purple-500',
  Chemistry: 'from-green-400 via-emerald-400 to-teal-500',
  Biology: 'from-green-300 via-lime-300 to-emerald-400',
  'Computer Science': 'from-gray-400 via-blue-400 to-indigo-500',
  'Social Studies': 'from-orange-300 via-red-300 to-pink-400',
  Music: 'from-purple-300 via-pink-300 to-red-300',
  'Physical Education': 'from-green-300 via-emerald-300 to-teal-400',
  'Foreign Languages': 'from-blue-300 via-indigo-300 to-purple-400',
  Business: 'from-gray-300 via-blue-300 to-indigo-400',
  Health: 'from-green-300 via-emerald-300 to-teal-400'
}

const typeCharacters = {
  slides: '📄',
  video: '🎥', 
  comic: '📖',
  image: '��️',
  content: '📝',
  assessment: '��',
  external: '��'
}

const subjects = [
  { id: 1, title: 'Math' },
  { id: 2, title: 'Science' },
  { id: 3, title: 'English' },
  { id: 4, title: 'History' },
  { id: 5, title: 'Art' },
  { id: 6, title: 'Geography' },
  { id: 7, title: 'Physics' },
  { id: 8, title: 'Chemistry' },
  { id: 9, title: 'Biology' },
  { id: 10, title: 'Computer Science' },
  { id: 11, title: 'Social Studies' },
  { id: 12, title: 'Music' },
  { id: 13, title: 'Physical Education' },
  { id: 14, title: 'Foreign Languages' },
  { id: 15, title: 'Business' },
  { id: 16, title: 'Health' }
]

const LibraryCharacter = () => (
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
)

const LearningLibrary = () => {
  const [selectedSubject, setSelectedSubject] = useState('All')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [syncing, setSyncing] = useState(false)
  const [completedIds, setCompletedIds] = useState(new Set())
  const [selectedResource, setSelectedResource] = useState(null)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [isLearningDialogOpen, setIsLearningDialogOpen] = useState(false)
  const [currentResource, setCurrentResource] = useState(null)

  const [resources, setResources] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    totalTimeSpent: 0,
    totalSubjects: 0
  })

  useEffect(() => {
    loadResources()
    loadStats()
  }, [])

  const loadResources = async () => {
    setIsLoading(true)
    try {
      console.log('Loading resources...')
      const result = await getAllStudentContent()
      console.log('Result from getAllStudentContent:', result)
      
      if (result.success) {
        console.log('Success! Lessons count:', result.lessons?.length)
        setResources(result.lessons)
        // Update completed IDs based on progress
        const completed = new Set()
        result.lessons.forEach(lesson => {
          if (lesson.progress && lesson.progress.status === 'completed') {
            completed.add(lesson._id)
          }
        })
        setCompletedIds(completed)
      } else {
        console.error('Failed to load resources:', result.error)
        toast.error(result.error || 'Failed to load resources')
      }
    } catch (error) {
      console.error('Error loading resources:', error)
      toast.error('Failed to load resources')
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await getLessonStats()
      if (result.success) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const syncResources = async () => {
    setSyncing(true)
    try {
      await loadResources()
      await loadStats()
      toast.success('Resources synced successfully! 🎉')
    } catch (error) {
      console.error('Error syncing resources:', error)
      toast.error('Failed to sync resources')
    } finally {
      setSyncing(false)
    }
  }

  const filteredResources = useMemo(() => {
    let filtered = [...resources]

    // Filter by subject
    if (selectedSubject !== 'All') {
      filtered = filtered.filter(resource => resource.subject === selectedSubject)
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(resource => {
        const title = resource.title || ''
        const description = resource.description || ''
        const subject = resource.subject || ''
        
        return title.toLowerCase().includes(searchTerm.toLowerCase()) ||
               description.toLowerCase().includes(searchTerm.toLowerCase()) ||
               subject.toLowerCase().includes(searchTerm.toLowerCase())
      })
    }

    // Filter by resource type
    if (activeTab === 'external') {
      filtered = filtered.filter(resource => resource.resourceType === 'external' || resource.externalUrl)
    } else if (activeTab !== 'all') {
      filtered = filtered.filter(resource => resource.resourceType === activeTab)
    }

    return filtered
  }, [resources, selectedSubject, searchTerm, activeTab])

  const getItemColor = (subject) => gradients[subject] || 'from-gray-300 to-gray-400'

  const handleStartLearning = async (resource) => {
    try {
      console.log('=== handleStartLearning ===');
      console.log('Resource passed to handleStartLearning:', resource);
      console.log('Resource progress:', resource.progress);
      
      // Update view count
      await updateLessonViewCount(resource._id)
      
      // Use the resource data directly instead of fetching from database
      // This preserves the progress data that was loaded with getAllStudentContent
      const content = {
        ...resource,
        id: resource._id,
        // Only map to 'slides' if it has presentationUrl or is actually a PPTX
        type: (resource.resourceType === 'presentation' && resource.presentationUrl) 
          ? 'slides' 
          : resource.resourceType,
        contentType: (resource.resourceType === 'presentation' && resource.presentationUrl) 
          ? 'slides' 
          : resource.resourceType
      }
      
      console.log('Content after mapping:', content);
      console.log('Content progress after mapping:', content.progress);
      
      setCurrentResource(content)
      setIsLearningDialogOpen(true)
    } catch (error) {
      console.error('Error starting learning:', error)
      toast.error('Failed to start learning')
    }
  }

  const handleCloseLearning = () => {
    setIsLearningDialogOpen(false)
    setCurrentResource(null)
    // Reload resources to update progress
    loadResources()
  }

  const handleCompleteLearning = (result) => {
    toast.success('Resource completed successfully! 🎉')
    // Reload resources to update progress
    loadResources()
    loadStats()
  }

  const handleReviewResource = (resource) => {
    setSelectedResource(resource)
    setIsReviewDialogOpen(true)
  }

  const handlePreviewResource = (resource) => {
    setSelectedResource(resource)
    setIsPreviewDialogOpen(true)
  }

  const renderGrid = (resourceList) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {resourceList.map((resource, index) => {
        const isCompleted = completedIds.has(resource._id)
        const progress = resource.progress?.percentage || 0
        
        return (
          <motion.div
            key={`${resource._id}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -5 }}
          >
            <Card 
              className={`border-0 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 bg-white dark:bg-gray-800 overflow-hidden group cursor-pointer h-full ${
                isCompleted ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''
              }`}
              onClick={() => handleStartLearning(resource)}
            >
              <div className={`relative h-32 bg-gradient-to-br ${getItemColor(resource.subject)} flex items-center justify-center overflow-hidden`}>
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-2 left-2 w-5 h-5 bg-white rounded-full"></div>
                  <div className="absolute top-3 right-3 w-4 h-4 bg-white rounded-full"></div>
                  <div className="absolute bottom-2 left-3 w-6 h-6 bg-white rounded-full"></div>
                </div>
                <div className="relative z-10 text-5xl transition-transform duration-300 group-hover:scale-110">
                  {typeCharacters[resource.resourceType] || '📄'}
                </div>
                {isCompleted && (
                  <div className="absolute right-2 top-2">
                    <Badge className="bg-emerald-600 text-white border-0 flex items-center gap-1 shadow-lg">
                      <CheckCircle className="h-3 w-3" /> Completed
                    </Badge>
                  </div>
                )}
                <div className="absolute bottom-2 left-2">
                  <Badge className="bg-black/20 text-white border-0 text-xs font-semibold backdrop-blur-sm">
                    ⭐ {resource.rating}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4 h-full flex flex-col">
                <div className="space-y-3 flex-1">
                  <div>
                    <h3 className="font-bold text-base text-gray-800 dark:text-white line-clamp-2 group-hover:text-purple-600 transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                      {resource.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`bg-gradient-to-r ${getItemColor(resource.subject)} text-white border-0 font-semibold text-xs`}>
                      {resource.subject}
                    </Badge>
                    <Badge variant="outline" className="text-xs">Grade {resource.grade}</Badge>
                    <Badge variant="outline" className="text-xs">{resource.difficulty}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {resource.estimatedTimeMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {resource.views}
                    </span>
                  </div>

                  {/* Progress indicator */}
                  {!isCompleted && progress > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                        <span>Progress</span>
                        <span>{Math.floor(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </div>
                
                <div className="mt-3 space-y-2">
                  <Button 
                    className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartLearning(resource)
                    }}
                  >
                    <Play className="mr-2 h-3 w-3" />
                    {isCompleted ? 'Review' : 'Start Learning!'} 🚀
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )

  const getTabIcon = (tabValue) => {
    switch(tabValue) {
      case 'all': return <Sparkles className="mr-1 h-4 w-4" />
      case 'slides': return <FileText className="mr-1 h-4 w-4" />
      case 'video': return <Film className="mr-1 h-4 w-4" />
      case 'comic': return <BookOpen className="mr-1 h-4 w-4" />
      case 'image': return <ImageIcon className="mr-1 h-4 w-4" />
      case 'content': return <FileText className="mr-1 h-4 w-4" />
      case 'assessment': return <Gamepad2 className="mr-1 h-4 w-4" />
      case 'external': return <ExternalLink className="mr-1 h-4 w-4" />
      default: return <FileText className="mr-1 h-4 w-4" />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-8 relative">
        <LibraryCharacter />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Your Learning Library 📚
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Discover amazing educational content across all subjects! From interactive slides to fun videos, 
            everything you need to learn and grow is right here. 🌟
          </p>
        </motion.div>

        <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm mb-8">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                  Explore by Subject 🌟
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Choose your favorite subjects and discover amazing content!
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <Badge 
                key="all" 
                variant={selectedSubject === 'All' ? "default" : "outline"} 
                className={`whitespace-nowrap cursor-pointer font-semibold text-xs px-3 py-1 rounded-full transition-all hover:scale-105 ${
                  selectedSubject === 'All'   
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0' 
                    : 'hover:bg-purple-100 dark:hover:bg-purple-800'
                }`}
                onClick={() => setSelectedSubject('All')}  
              >
                All Subjects ��
              </Badge>
              {subjects.map((subject) => (
                <Badge 
                  key={subject.id} 
                  variant={selectedSubject === subject.title ? "default" : "outline"} 
                  className={`whitespace-nowrap cursor-pointer font-semibold text-xs px-3 py-1 rounded-full transition-all hover:scale-105 ${
                    selectedSubject === subject.title   
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0' 
                      : 'hover:bg-purple-100 dark:hover:bg-purple-800'
                  }`}
                  onClick={() => setSelectedSubject(subject.title)}  
                >
                 {subject.title}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap justify-start gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg p-3">
            {['all', 'slides', 'video', 'comic', 'image', 'content', 'assessment', 'external'].map((tab, index) => (
              <TabsTrigger 
                key={tab}
                value={tab} 
                className={`flex items-center rounded-xl font-semibold text-xs px-4 py-2 transition-all data-[state=active]:text-white shadow-sm ${
                  index === 0 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-400 data-[state=active]:to-pink-500' :
                  index === 1 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-400 data-[state=active]:to-purple-500' :
                  index === 2 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-400 data-[state=active]:to-blue-500' :
                  index === 3 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-400 data-[state=active]:to-red-500' :
                  index === 4 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-orange-500' :
                  index === 5 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-400 data-[state=active]:to-blue-500' :
                  index === 6 ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-400 data-[state=active]:to-pink-500' :
                  'data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-400 data-[state=active]:to-pink-500'
                }`}
              >
                {getTabIcon(tab)}
                <span className="hidden sm:inline capitalize">{tab === 'external' ? 'Links' : tab}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {['all', 'slides', 'video', 'comic', 'image', 'content', 'assessment'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
              ) : (
                <>
                  {filteredResources.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-16"
                    >
                      <div className="text-6xl mb-4">🔍</div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No {tab === 'all' ? 'content' : tab} found</h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                        Try adjusting your filters or sync more content to discover amazing {tab === 'all' ? 'content' : tab}!
                      </p>
                      <Button 
                        onClick={syncResources} 
                        disabled={syncing} 
                        className="rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
                      >
                        {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync More Content
                      </Button>
                    </motion.div>
                  ) : (
                    renderGrid(filteredResources)
                  )}
                </>
              )}
            </TabsContent>
          ))}

          <TabsContent value="external">
            <Card className="border-0 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
              <div className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 px-6 py-6 rounded-t-3xl">
                <CardTitle className="text-white text-2xl font-bold flex items-center gap-3">
                  <ExternalLink className="h-6 w-6" /> Amazing External Resources!
                </CardTitle>
                <CardDescription className="text-white/90 text-base font-medium mt-2">
                  Fun links and activities for you! 🌟
                </CardDescription>
              </div>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                      <Award className="h-5 w-5 text-blue-500" />
                      Educational Websites 🎓
                    </h3>
                    {[
                      { name: 'Khan Academy Kids ��', url: 'https://www.khanacademy.org/kids', color: 'from-blue-500 to-purple-500' },
                      { name: 'Scratch Programming ��', url: 'https://scratch.mit.edu', color: 'from-orange-500 to-red-500' },
                      { name: 'NASA Kids Club ��', url: 'https://www.nasa.gov/kidsclub', color: 'from-indigo-500 to-blue-500' }
                    ].map((site, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-800 dark:to-purple-800 rounded-2xl p-4 flex items-center justify-between shadow-md hover:shadow-lg transition-all duration-300"
                      >
                        <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">{site.name}</span>
                        <Button 
                          className={`rounded-full bg-gradient-to-r ${site.color} text-white text-xs font-semibold px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300`}
                          onClick={() => window.open(site.url, '_blank')}
                        >
                          Visit! 🌟
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                      <Target className="h-5 w-5 text-pink-500" />
                      Fun Activities 🎨
                    </h3>
                    {[
                      { name: 'Art & Crafts 🎨', url: '#', color: 'from-pink-500 to-orange-500' },
                      { name: 'Science Experiments 🧪', url: '#', color: 'from-green-500 to-teal-500' },
                      { name: 'Math Puzzles 🧩', url: '#', color: 'from-purple-500 to-indigo-500' }
                    ].map((activity, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-gradient-to-r from-pink-100 to-orange-100 dark:from-pink-800 dark:to-orange-800 rounded-2xl p-4 flex items-center justify-between shadow-md hover:shadow-lg transition-all duration-300"
                      >
                        <span className="font-semibold text-sm text-gray-800 dark:text-white truncate">{activity.name}</span>
                        <Button className={`rounded-full bg-gradient-to-r ${activity.color} text-white text-xs font-semibold px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-300`}>
                          Try It! 🚀
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8"
        >
          {[
            { icon: '📄', value: stats.totalLessons, label: 'Amazing Resources!', color: 'from-yellow-300 to-orange-400' },
            { icon: '⏰', value: stats.totalTimeSpent, label: 'Minutes of Fun!', color: 'from-green-300 to-blue-400' },
            { icon: '��', value: stats.totalSubjects, label: 'Subjects to Explore!', color: 'from-purple-300 to-pink-400' },
            { icon: '✅', value: stats.completedLessons, label: 'Completed Items!', color: 'from-emerald-300 to-teal-400' }
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <Card 
                className={`border-0 rounded-3xl shadow-xl bg-gradient-to-br ${stat.color} text-white overflow-hidden`}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">{stat.icon}</div>
                  <p className="text-2xl font-bold mb-1">{stat.value}</p>
                  <p className="text-sm font-medium">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-0">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                Resource Review
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReviewDialogOpen(false)}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              Review your completed learning resource and track your progress
            </DialogDescription>
          </DialogHeader>
          
          {selectedResource && (
            <div className="space-y-6">
              {/* Resource Header */}
              <div className={`relative h-48 bg-gradient-to-br ${getItemColor(selectedResource.subject)} rounded-2xl flex items-center justify-center overflow-hidden`}>
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-4 left-4 w-8 h-8 bg-white rounded-full"></div>
                  <div className="absolute top-6 right-6 w-6 h-6 bg-white rounded-full"></div>
                  <div className="absolute bottom-4 left-6 w-10 h-10 bg-white rounded-full"></div>
                </div>
                <div className="relative z-10 text-8xl">
                  {typeCharacters[selectedResource.resourceType] || '📄'}
                </div>
                <div className="absolute top-4 right-4">
                  <Badge className="bg-emerald-600 text-white border-0 flex items-center gap-2 shadow-lg">
                    <CheckCircle className="h-4 w-4" /> Completed
                  </Badge>
                </div>
              </div>

              {/* Resource Info */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    {selectedResource.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    {selectedResource.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">⭐</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Rating</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.rating}</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900 dark:to-teal-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">👁️</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Views</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.views}</div>
                  </div>
                  <div className="bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900 dark:to-red-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">❤️</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Likes</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.likes}</div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900 dark:to-orange-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">⏰</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Duration</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.estimatedTimeMinutes}m</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={`bg-gradient-to-r ${getItemColor(selectedResource.subject)} text-white border-0 font-semibold`}>
                    {selectedResource.subject}
                  </Badge>
                  <Badge variant="outline" className="font-semibold">Grade {selectedResource.grade}</Badge>
                  <Badge variant="outline" className="font-semibold">{selectedResource.difficulty}</Badge>
                  <Badge variant="outline" className="font-semibold capitalize">{selectedResource.resourceType}</Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <Calendar className="h-4 w-4" />
                  Completed on {new Date().toLocaleDateString()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg"
                  onClick={() => {
                    handleStartLearning(selectedResource)
                    setIsReviewDialogOpen(false)
                  }}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Review Again
                </Button>
                <Button 
                  variant="outline"
                  className="rounded-xl font-semibold border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
                <Button 
                  variant="outline"
                  className="rounded-xl font-semibold border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Bookmark className="mr-2 h-4 w-4" />
                  Bookmark
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-0">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <EyeIcon className="h-6 w-6 text-blue-500" />
                Resource Preview
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewDialogOpen(false)}
                className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              Preview the learning resource before starting
            </DialogDescription>
          </DialogHeader>
          
          {selectedResource && (
            <div className="space-y-6">
              {/* Resource Header */}
              <div className={`relative h-48 bg-gradient-to-br ${getItemColor(selectedResource.subject)} rounded-2xl flex items-center justify-center overflow-hidden`}>
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-4 left-4 w-8 h-8 bg-white rounded-full"></div>
                  <div className="absolute top-6 right-6 w-6 h-6 bg-white rounded-full"></div>
                  <div className="absolute bottom-4 left-6 w-10 h-10 bg-white rounded-full"></div>
                </div>
                <div className="relative z-10 text-8xl">
                  {typeCharacters[selectedResource.resourceType] || '📄'}
                </div>
                <div className="absolute top-4 right-4">
                  <Badge className="bg-blue-600 text-white border-0 flex items-center gap-2 shadow-lg">
                    <EyeIcon className="h-4 w-4" /> Preview
                  </Badge>
                </div>
              </div>

              {/* Resource Info */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
                    {selectedResource.title}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    {selectedResource.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">⭐</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Rating</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.rating || 4.5}</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900 dark:to-teal-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">👁️</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Views</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.views || 0}</div>
                  </div>
                  <div className="bg-gradient-to-r from-pink-50 to-red-50 dark:from-pink-900 dark:to-red-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">❤️</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Likes</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.likes || 0}</div>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900 dark:to-orange-900 rounded-xl p-4 text-center">
                    <div className="text-2xl mb-1">⏰</div>
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-300">Duration</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-white">{selectedResource.estimatedTimeMinutes || 10}m</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={`bg-gradient-to-r ${getItemColor(selectedResource.subject)} text-white border-0 font-semibold`}>
                    {selectedResource.subject}
                  </Badge>
                  <Badge variant="outline" className="font-semibold">Grade {selectedResource.grade}</Badge>
                  <Badge variant="outline" className="font-semibold">{selectedResource.difficulty || 'Beginner'}</Badge>
                  <Badge variant="outline" className="font-semibold capitalize">{selectedResource.resourceType}</Badge>
                </div>

                {/* Preview Content */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Preview Content</h3>
                  <div className="aspect-video bg-white dark:bg-gray-800 rounded-xl shadow-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">
                        {typeCharacters[selectedResource.resourceType] || '📄'}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">
                        {selectedResource.resourceType === 'slides' && 'Interactive slides with engaging content'}
                        {selectedResource.resourceType === 'video' && 'Educational video with clear explanations'}
                        {selectedResource.resourceType === 'comic' && 'Fun comic story with learning elements'}
                        {selectedResource.resourceType === 'image' && 'Interactive image with annotations'}
                        {selectedResource.resourceType === 'content' && 'Comprehensive learning materials'}
                        {selectedResource.resourceType === 'assessment' && 'Interactive quiz and questions'}
                        {!['slides', 'video', 'comic', 'image', 'content', 'assessment'].includes(selectedResource.resourceType) && 'Learning content'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg"
                  onClick={() => {
                    handleStartLearning(selectedResource)
                    setIsPreviewDialogOpen(false)
                  }}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Learning Now!
                </Button>
                <Button 
                  variant="outline"
                  className="rounded-xl font-semibold border-purple-200 text-purple-600 hover:bg-purple-50"
                  onClick={() => setIsPreviewDialogOpen(false)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Learning Dialog */}
      <LearningDialog
        isOpen={isLearningDialogOpen}
        onClose={handleCloseLearning}
        content={currentResource}  // Changed from resource to content
        onComplete={handleCompleteLearning}
      />
    </div>
  )
}

export default LearningLibrary