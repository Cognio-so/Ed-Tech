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
    <div className="min-h-screen bg-background">
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
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent mb-4">
                AI Media Toolkit
              </h1>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div variants={itemVariants}>
          <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8 bg-card border shadow-lg">
              <TabsTrigger 
                value="slides" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Presentation className="h-4 w-4" />
                <span className="hidden sm:inline">Slides</span>
              </TabsTrigger>
              <TabsTrigger 
                value="video" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger 
                value="images" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Image className="h-4 w-4" />
                <span className="hidden sm:inline">Images</span>
              </TabsTrigger>
              <TabsTrigger 
                value="comics" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Comics</span>
              </TabsTrigger>
              <TabsTrigger 
                value="web" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Web</span>
              </TabsTrigger>
            </TabsList>

            <Card className="bg-card border shadow-2xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {activeSection === "slides" && <Presentation className="h-6 w-6 text-primary" />}
                  {activeSection === "video" && <Video className="h-6 w-6 text-primary" />}
                  {activeSection === "images" && <Image className="h-6 w-6 text-primary" />}
                  {activeSection === "comics" && <BookOpen className="h-6 w-6 text-primary" />}
                  {activeSection === "web" && <Globe className="h-6 w-6 text-primary" />}
                  <div>
                    <CardTitle className="text-2xl text-foreground">
                      {activeSection === "slides" && "Interactive Presentation Slides"}
                      {activeSection === "video" && "Educational Video Creation"}
                      {activeSection === "images" && "AI Image Generator"}
                      {activeSection === "comics" && "Comics & Cartoon Generator"}
                      {activeSection === "web" && "Web Media Suggestions"}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                      {activeSection === "slides" && "Create engaging presentations with AI-powered slide generation"}
                      {activeSection === "video" && "Generate professional educational videos with AI avatars"}
                      {activeSection === "images" && "Create custom educational images with AI"}
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
                <Card className="bg-card border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <Presentation className="h-5 w-5" />
                      {generatedContent.slides.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{generatedContent.slides.preview}</p>
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
                <Card className="bg-card border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      {generatedContent.video.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{generatedContent.video.preview}</p>
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
                <Card className="bg-secondary border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
                      <Image className="h-5 w-5" />
                      {generatedContent.images.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{generatedContent.images.preview}</p>
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
                <Card className="bg-secondary border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {generatedContent.comics.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{generatedContent.comics.preview}</p>
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
                <Card className="bg-card border shadow-2xl">
                  <CardHeader>
                    <CardTitle className="text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      {generatedContent.web.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{generatedContent.web.preview}</p>
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