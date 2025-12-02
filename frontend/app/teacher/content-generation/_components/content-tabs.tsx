"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentGenerationForm } from "./content-generation-form";
import { SavedContentList } from "./saved-content-list";

interface ContentTabsProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function ContentTabs({
  initialGrades,
  initialSubjects,
}: ContentTabsProps) {
  const [activeTab, setActiveTab] = React.useState("form");

  React.useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab("form");
    };

    window.addEventListener("switchToFormTab", handleSwitchTab);
    return () => {
      window.removeEventListener("switchToFormTab", handleSwitchTab);
    };
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form">Generate Content</TabsTrigger>
        <TabsTrigger value="saved">Saved Content</TabsTrigger>
      </TabsList>

      <TabsContent value="form" className="mt-6">
        <ContentGenerationForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="saved" className="mt-6">
        <SavedContentList />
      </TabsContent>
    </Tabs>
  );
}
