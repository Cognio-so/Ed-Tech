"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentForm } from "./assessment-form";
import { SavedAssessmentsList } from "./saved-assessments-list";

interface AssessmentTabsProps {
  initialGrades: { id: string; name: string }[];
  initialSubjects: { id: string; name: string }[];
}

export function AssessmentTabs({
  initialGrades,
  initialSubjects,
}: AssessmentTabsProps) {
  const [activeTab, setActiveTab] = React.useState("form");

  React.useEffect(() => {
    const handleSwitchTab = () => {
      setActiveTab("form");
    };

    window.addEventListener("switchToAssessmentFormTab", handleSwitchTab);
    return () => {
      window.removeEventListener("switchToAssessmentFormTab", handleSwitchTab);
    };
  }, []);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="form">Generate Assessment</TabsTrigger>
        <TabsTrigger value="saved">Saved Assessments</TabsTrigger>
      </TabsList>

      <TabsContent value="form" className="mt-6">
        <AssessmentForm
          initialGrades={initialGrades}
          initialSubjects={initialSubjects}
        />
      </TabsContent>

      <TabsContent value="saved" className="mt-6">
        <SavedAssessmentsList />
      </TabsContent>
    </Tabs>
  );
}
