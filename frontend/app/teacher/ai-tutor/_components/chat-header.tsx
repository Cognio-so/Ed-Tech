"use client"

import * as React from "react"
import { MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { authClient } from "@/lib/auth-client"
import { toast } from "sonner"

interface ChatHeaderProps {
  onNewChat: () => void
  grades: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
  selectedGrades?: string[]
  selectedSubject?: string
  onGradeChange?: (grades: string[]) => void
  onSubjectChange?: (subject: string) => void
}

export function ChatHeader({
  onNewChat,
  grades,
  subjects,
  selectedGrades = [],
  selectedSubject,
  onGradeChange,
  onSubjectChange,
}: ChatHeaderProps) {
  const { data: session } = authClient.useSession()

  const handleNewChat = () => {
    onNewChat()
    toast.success("New chat started")
  }

  const handleGradeSelect = React.useCallback((gradeName: string) => {
    if (gradeName === "all") {
      onGradeChange?.([])
      return
    }
    
    const newGrades = selectedGrades.includes(gradeName)
      ? selectedGrades.filter((g) => g !== gradeName)
      : [...selectedGrades, gradeName]
    onGradeChange?.(newGrades)
  }, [selectedGrades, onGradeChange])
  
  const selectValue = React.useMemo(() => {
    return selectedGrades.length > 0 ? selectedGrades[0] : "all"
  }, [selectedGrades])

  const userName = session?.user?.name || "User"
  const userEmail = session?.user?.email || ""
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex-shrink-0 border-b bg-background">
      <div className="flex items-center justify-between gap-4 p-3 sm:p-4  mx-auto w-full">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col min-w-0">
              <span className="text-2xl font-bold text-primary truncate">
                AI Assistant
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="relative">
              <Select
                value={selectValue}
                onValueChange={handleGradeSelect}
              >
                <SelectTrigger className="w-[140px] rounded-full">
                  <SelectValue placeholder={selectedGrades.length > 0 ? `${selectedGrades.length} selected` : "Grades"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {grades.map((grade) => (
                    <SelectItem key={grade.id} value={grade.name}>
                      {grade.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGrades.length > 1 && (
                <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {selectedGrades.length}
                </div>
              )}
            </div>

            <Select
              value={selectedSubject && selectedSubject !== "all" ? selectedSubject : "all"}
              onValueChange={(value) => onSubjectChange?.(value === "all" ? "" : value)}
            >
              <SelectTrigger className="w-[140px] rounded-full">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="hidden sm:flex items-center gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>


          <ThemeToggle />

          <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
            <AvatarImage
              src={session?.user.image || undefined}
              alt={userName}
            />
            <AvatarFallback className="bg-muted text-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </div>
  )
}
