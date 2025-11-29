"use client";

import * as React from "react";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Image,
  Library,
  Users,
  Bot,
  History,
  Settings,
} from "lucide-react";
import { AppSidebar } from "./app-sidebar";

const teacherNavItems = [
  {
    title: "Dashboard",
    url: "/teacher",
    icon: LayoutDashboard,
  },
  {
    title: "Content Generation",
    url: "/teacher/content-generation",
    icon: FileText,
  },
  {
    title: "Assessment Generation",
    url: "/teacher/assessment-generation",
    icon: ClipboardList,
  },
  {
    title: "Media Toolkit",
    url: "/teacher/media-toolkit",
    icon: Image,
  },
  {
    title: "Library",
    url: "/teacher/library",
    icon: Library,
  },
  {
    title: "Class Grouping",
    url: "/teacher/class-grouping",
    icon: Users,
  },
  {
    title: "AI Tutor",
    url: "/teacher/ai-tutor",
    icon: Bot,
  },
  {
    title: "History",
    url: "/teacher/history",
    icon: History,
  },
  {
    title: "Settings",
    url: "/teacher/settings",
    icon: Settings,
  },
];

export function TeacherSidebar(props: React.ComponentProps<typeof AppSidebar>) {
  return <AppSidebar navItems={teacherNavItems} basePath="/teacher" {...props} />;
}

