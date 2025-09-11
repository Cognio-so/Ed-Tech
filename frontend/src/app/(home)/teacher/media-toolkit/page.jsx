"use client";

import React, { useState } from "react"
import { motion } from "framer-motion"
import { Presentation, Video, Image, BookOpen, Globe, Sparkles, Download, Edit, Play, Bookmark, Share, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import SlidesGenerator from "./sldies/page"
import VideoCreator from "./video/page"
import ImageGenerator from "./images/page"
import ComicsCreator from "./comic/page"
import WebContentCurator from "./web-search/page"

const MediaToolkitPage = () => {
  const [activeSection, setActiveSection] = useState("slides")
  const [generatedContent, setGeneratedContent] = useState({
    slides: null,
    video: null,
    images: null,
    comics: null,
    web: null
  })

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  }

    return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <motion.div
        className="container mx-auto px-4 py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div className="text-center mb-12" variants={itemVariants}>
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur opacity-30"></div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                AI Media Toolkit
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-lg">
              <TabsTrigger value="slides" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Presentation className="h-4 w-4" />
                <span className="hidden sm:inline">Slides</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-teal-600 data-[state=active]:text-white">
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Images</span>
              </TabsTrigger>
              <TabsTrigger value="comics" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-600 data-[state=active]:text-white">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Comics</span>
              </TabsTrigger>
              <TabsTrigger value="web" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-blue-600 data-[state=active]:text-white">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Web</span>
              </TabsTrigger>
            </TabsList>

            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-2xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {activeSection === "slides" && <Presentation className="h-6 w-6 text-blue-600" />}
                  {activeSection === "video" && <Video className="h-6 w-6 text-red-600" />}
                  {activeSection === "images" && <Image className="h-6 w-6 text-green-600" />}
                  {activeSection === "comics" && <BookOpen className="h-6 w-6 text-yellow-600" />}
                  {activeSection === "web" && <Globe className="h-6 w-6 text-indigo-600" />}
        <div>
                    <CardTitle className="text-2xl">
                      {activeSection === "slides" && "Interactive Presentation Slides"}
                      {activeSection === "video" && "Educational Video Creation"}
                      {activeSection === "images" && "Educational Images & Diagrams"}
                      {activeSection === "comics" && "Comics & Cartoon Generator"}
                      {activeSection === "web" && "Web Media Suggestions"}
                    </CardTitle>
                    <CardDescription>
                      {activeSection === "slides" && "Create engaging presentations with AI-powered slide generation"}
                      {activeSection === "video" && "Generate professional educational videos with AI avatars"}
                      {activeSection === "images" && "Create custom educational images and diagrams"}
                      {activeSection === "comics" && "Design educational comics and animated content"}
                      {activeSection === "web" && "Curate safe and educational web content"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TabsContent value="slides">
                  <SlidesGenerator setGeneratedContent={setGeneratedContent} />
                </TabsContent>
                <TabsContent value="video">
                  <VideoCreator setGeneratedContent={setGeneratedContent} />
                </TabsContent>
                <TabsContent value="images">
                  <ImageGenerator setGeneratedContent={setGeneratedContent} />
                </TabsContent>
                <TabsContent value="comics">
                  <ComicsCreator setGeneratedContent={setGeneratedContent} />
                </TabsContent>
                <TabsContent value="web">
                  <WebContentCurator setGeneratedContent={setGeneratedContent} />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </motion.div>

        {/* Generated Content Display */}
        {Object.values(generatedContent).some(content => content !== null) && (
          <motion.div 
            className="mt-8 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedContent.slides && (
                <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <Presentation className="h-5 w-5" />
                      {generatedContent.slides.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-blue-700 dark:text-blue-300 mb-4">{generatedContent.slides.preview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {generatedContent.video && (
                <Card className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      {generatedContent.video.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-red-700 dark:text-red-300 mb-4">{generatedContent.video.preview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Play className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {generatedContent.images && (
                <Card className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 border-green-200 dark:border-green-800">
                  <CardHeader>
                    <CardTitle className="text-green-800 dark:text-green-200 flex items-center gap-2">
                      <Image className="h-5 w-5" />
                      {generatedContent.images.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-green-700 dark:text-green-300 mb-4">{generatedContent.images.preview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {generatedContent.comics && (
                <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-800">
                  <CardHeader>
                    <CardTitle className="text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {generatedContent.comics.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-yellow-700 dark:text-yellow-300 mb-4">{generatedContent.comics.preview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        Read
                      </Button>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {generatedContent.web && (
                <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
                  <CardHeader>
                    <CardTitle className="text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      {generatedContent.web.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-indigo-700 dark:text-indigo-300 mb-4">{generatedContent.web.preview}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Bookmark className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline">
                        <Share className="h-4 w-4 mr-1" />
                        Share
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
        </div>
    )
}

export default MediaToolkitPage