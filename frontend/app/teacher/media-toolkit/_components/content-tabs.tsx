"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlideForm } from "./slide-form";
import { ImageForm } from "./image-form";
import { WebSearchForm } from "./web-search-form";
import { ComicForm } from "./comic-form";
import { VideoForm } from "./video-form";

interface ContentTabsProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function ContentTabs({
  initialGrades,
  initialSubjects,
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = React.useState("slide");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="inline-flex h-9 w-full items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground">
        <TabsTrigger value="slide" className="flex-1">
          Slide
        </TabsTrigger>
        <TabsTrigger value="image" className="flex-1">
          Image
        </TabsTrigger>
        <TabsTrigger value="web" className="flex-1">
          Web
        </TabsTrigger>
        <TabsTrigger value="comic" className="flex-1">
          Comic
        </TabsTrigger>
        <TabsTrigger value="video" className="flex-1">
          Video
        </TabsTrigger>
      </TabsList>

      <TabsContent value="slide" className="mt-6">
        <SlideForm />
      </TabsContent>

      <TabsContent value="image" className="mt-6">
        <ImageForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="web" className="mt-6">
        <WebSearchForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="comic" className="mt-6">
        <ComicForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="video" className="mt-6">
        <VideoForm />
      </TabsContent>
    </Tabs>
  );
}
