"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentList } from "./student-list";
import { FeedbackList } from "./feedback-list";
import { PerformanceList } from "./performance-list";
import type { StudentData } from "@/data/get-student-data";

interface ClassTabsProps {
  students: StudentData[];
}

export function ClassTabs({ students }: ClassTabsProps) {
  const [activeTab, setActiveTab] = React.useState("students");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="students">Students</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
      </TabsList>

      <TabsContent value="students" className="mt-6">
        <StudentList students={students} />
      </TabsContent>

      <TabsContent value="performance" className="mt-6">
        <PerformanceList students={students} />
      </TabsContent>

      <TabsContent value="feedbacks" className="mt-6">
        <FeedbackList students={students} />
      </TabsContent>
    </Tabs>
  );
}

