"use client"

import { type LucideIcon } from "lucide-react"
import Link from "next/link"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
  }[]
}) {
  return (
    <SidebarGroup className="px-2">
      <SidebarMenu className="space-y-1">
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton 
              asChild 
              isActive={item.isActive}
              className={`
                w-full justify-start px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                hover:bg-accent hover:text-accent-foreground
                ${item.isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <Link href={item.url} className="flex items-center gap-3 w-full">
                {item.icon && (
                  <item.icon className={`
                    w-4 h-4 transition-colors duration-200
                    ${item.isActive ? 'text-primary' : 'text-muted-foreground'}
                  `} />
                )}
                <span className="truncate">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}