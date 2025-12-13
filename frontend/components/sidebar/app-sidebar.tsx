"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Calendar, type LucideIcon } from "lucide-react";
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
    title: "View Attendance",
    url: "/admin/view-attendance",
    icon: Calendar,
  },
  
  // {
  //   title: "Settings",
  //   url: "/admin/settings",
  //   icon: Settings,
  // },
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
  const navMain = navItems.map((item) => {
    // Exact match always takes priority
    if (pathname === item.url) {
      return { ...item, isActive: true };
    }
    
    // If this is the basePath item (like /admin), only match exactly
    // Don't match it when we're on child routes like /admin/users
    if (basePath && item.url === basePath) {
      return { ...item, isActive: pathname === basePath };
    }
    
    // For other routes, check if pathname starts with the item URL
    // This handles nested routes like /admin/users/123
    const isActive = pathname.startsWith(`${item.url}/`);
    
    return { ...item, isActive };
  });

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