"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderOpen,
  Users,
  Wrench,
  History,
  Settings,
  Database,
} from "lucide-react";

import { NavMain } from "@/components/sidebar/nav-main";
import { NavUser } from "@/components/sidebar/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { TeamSwitcher } from "./team-switcher";

const defaultNavItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Teams",
    url: "/admin/teams",
    icon: Users,
  },
  {
    title: "Tools",
    url: "/admin/tools",
    icon: Wrench,
  },
  {
    title: "KnowledgeBase",
    url: "/admin/knowledgebase",
    icon: Database,
  },
  {
    title: "History",
    url: "/admin/history",
    icon: History,
  },
  {
    title: "Settings",
    url: "/admin/settings",
    icon: Settings,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  navItems?: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
  basePath?: string;
}

export function AppSidebar({ navItems = defaultNavItems, basePath, ...props }: AppSidebarProps) {
  const { state } = useSidebar();
  const pathname = usePathname();

  // Add isActive property based on current pathname
  const navMain = navItems.map((item) => ({
    ...item,
    isActive: basePath
      ? pathname === item.url || (item.url !== basePath && pathname.startsWith(item.url))
      : pathname === item.url || (item.url !== "/admin" && pathname.startsWith(item.url)),
  }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="flex items-center justify-between">
        <TeamSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      
      <SidebarFooter className="space-y-2">
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}