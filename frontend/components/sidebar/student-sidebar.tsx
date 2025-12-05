"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Library,
  Trophy,
  Bot,
  History,
  Settings,
} from "lucide-react";
import { AppSidebar } from "./app-sidebar";

const studentNavItems = [
  {
    title: "Dashboard",
    url: "/student",
    icon: LayoutDashboard,
  },
  {
    title: "Learning Library",
    url: "/student/learning-library",
    icon: Library,
  },
  {
    title: "Achievements",
    url: "/student/achievements",
    icon: Trophy,
  },
  {
    title: "AI Assistant",
    url: "/student/ai-assistant",
    icon: Bot,
  },
  {
    title: "History",
    url: "/student/history",
    icon: History,
  },
  {
    title: "Settings",
    url: "/student/settings",
    icon: Settings,
  },
];

export function StudentSidebar(props: React.ComponentProps<typeof AppSidebar>) {
  return <AppSidebar navItems={studentNavItems} basePath="/student" {...props} />;
}

