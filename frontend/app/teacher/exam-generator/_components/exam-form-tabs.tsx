"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExamGeneratorForm } from "./exam-generator-form";
import { SavedExamsList } from "./saved-exams-list";

interface ExamTabsProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function ExamTabs({
  initialGrades,
  initialSubjects,
}: ExamTabsProps) {
  const [activeTab, setActiveTab] = React.useState("form");

  React.useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab("form");
    };

    window.addEventListener("switchToExamFormTab", handleSwitchTab);
    return () => {
      window.removeEventListener("switchToExamFormTab", handleSwitchTab);
    };
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form">Generate Exam</TabsTrigger>
        <TabsTrigger value="saved">Saved Exams</TabsTrigger>
      </TabsList>

      <TabsContent value="form" className="mt-6">
        <ExamGeneratorForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="saved" className="mt-6">
        <SavedExamsList />
      </TabsContent>
    </Tabs>
  );
}

