"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useStudentAITutor } from "@/hooks/use-student-ai-tutor";
import { ChatInput } from "./_components/ai-chat-input";
import { ChatMessages } from "./_components/ai-chat-message";
import { ChatHeader } from "./_components/ai-chat-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface StudentProfile {
  name: string;
  grade: string | null;
  subjects: string[];
  achievements: string[];
  totalScore: number;
  currentTier: string;
}

export default function AIAssistantPage() {
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [pendingAssignments, setPendingAssignments] = useState<Array<Record<string, any>>>([]);
  const [completedAssignments, setCompletedAssignments] = useState<Array<Record<string, any>>>([]);

  const {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearMessages,
    addVoiceMessage,
  } = useStudentAITutor({ sessionId });

  const hasMessages = messages.length > 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function fetchStudentData() {
      try {
        const sessionData = await authClient.getSession();
        if (sessionData?.data?.user?.id) {
          const sId = sessionData.data.user.id;
          setStudentId(sId);

          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
            
            const sessRes = await fetch(`${backendUrl}/api/student/${sId}/sessions`, {
              method: "POST"
            });
            
            if (sessRes.ok) {
              const sessData = await sessRes.json();
              if (sessData.session_id) {
                console.log("✅ Session created by backend:", sessData.session_id);
                setSessionId(sessData.session_id);
              } else {
                console.error("❌ Backend did not return session_id");
              }
            } else {
              const errorText = await sessRes.text();
              console.error("❌ Failed to create session:", sessRes.status, errorText);
              // Don't set fallback session - wait for backend to be available
            }
          } catch (e) {
            console.error("❌ Error creating session:", e);
            // Don't set fallback session - wait for backend to be available
          }
        }

        // Fetch student profile data
        const [profileRes, statsRes, contentRes] = await Promise.all([
          fetch("/api/student/profile"),
          fetch("/api/student/stats"),
          fetch("/api/student/content"),
        ]);

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setStudentProfile({
            name: profile.name || "Student",
            grade: profile.grade || null,
            subjects: profile.subjects || [],
            achievements: profile.achievements || [],
            totalScore: profile.totalScore || 0,
            currentTier: profile.currentTier || "starter",
          });

          if (profile.subjects && profile.subjects.length > 0) {
            const subjectList = profile.subjects.map(
              (name: string, index: number) => ({
                id: `subject-${index}`,
                name,
              })
            );
            setSubjects(subjectList);
          }
        }

        if (statsRes.ok) {
          const stats = await statsRes.json();
          if (stats.achievement) {
            const unlockedTiers = typeof stats.achievement.unlockedTiers === "string"
              ? JSON.parse(stats.achievement.unlockedTiers)
              : stats.achievement.unlockedTiers || [];
            
            setStudentProfile((prev) => ({
              ...prev!,
              achievements: unlockedTiers,
              totalScore: stats.achievement.totalScore || 0,
              currentTier: stats.achievement.currentTier || "starter",
            }));
          }
        }

        if (contentRes.ok) {
          const content = await contentRes.json();
          // Separate pending and completed assignments
          // For now, we'll treat all content as potential assignments
          // You can customize this logic based on your needs
          const pending: Array<Record<string, any>> = [];
          const completed: Array<Record<string, any>> = [];
          
          // This is a placeholder - you may need to adjust based on your data structure
          content.forEach((item: any) => {
            if (item.completed) {
              completed.push({
                title: item.title,
                type: item.contentType,
              });
            } else {
              pending.push({
                title: item.title,
                type: item.contentType,
                due: "Soon",
              });
            }
          });
          
          setPendingAssignments(pending);
          setCompletedAssignments(completed);
        }
      } catch (error) {
        console.error("Error fetching student data:", error);
      }
    }
    fetchStudentData();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current && hasMessages) {
      const viewport = scrollAreaRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement;
      if (viewport) {
        scrollContainerRef.current = viewport;
      }
    }
  }, [hasMessages, messages.length]);

  useEffect(() => {
    if (hasMessages && scrollContainerRef.current) {
      const isStreaming = isLoading || streamingContent.length > 0;

      if (isStreaming || isLoading || messages.length > 0) {
        const timeoutId = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
              top: scrollContainerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }
        }, 100);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages, streamingContent, isLoading, hasMessages]);

  const handleSend = useCallback(
    async (
      message: string,
      options?: {
        docUrl?: string;
        uploadedDocs?: Array<{
          url: string;
          filename: string;
          type: string;
        }>;
        model?: string;
      }
    ) => {
      const studentProfileData = studentProfile
        ? {
            name: studentProfile.name,
            grade: studentProfile.grade,
            subjects: studentProfile.subjects,
            achievements: studentProfile.achievements,
            totalScore: studentProfile.totalScore,
            currentTier: studentProfile.currentTier,
          }
        : undefined;

      const finalSubject =
        selectedSubject &&
          selectedSubject !== "all" &&
          selectedSubject.trim() !== ""
          ? selectedSubject
          : subject && subject !== "all" && subject.trim() !== ""
            ? subject
            : undefined;

      await sendMessage(message, {
        studentProfile: studentProfileData,
        pendingAssignments: pendingAssignments.length > 0 ? pendingAssignments : undefined,
        completedAssignments: completedAssignments.length > 0 ? completedAssignments : undefined,
        achievements: studentProfile?.achievements || undefined,
        topic: topic || undefined,
        subject: finalSubject,
        docUrl: options?.docUrl,
        uploadedDocs: options?.uploadedDocs,
        language: "English",
        model: options?.model,
      });
    },
    [studentProfile, topic, subject, selectedSubject, pendingAssignments, completedAssignments, sendMessage]
  );

  const handleClear = useCallback(() => {
    clearMessages();
    toast.success("Chat history cleared");
  }, [clearMessages]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setTopic("");
    setSubject("");
    setSelectedSubject("");
  }, [clearMessages]);

  const handleSubjectChange = useCallback((subject: string) => {
    setSelectedSubject(subject);
    setSubject(subject);
  }, []);

  const getSelectedSubjectValue = () => {
    return selectedSubject || "all";
  };

  const handleTranscription = useCallback(
    (text: string, role: "user" | "assistant") => {
      console.log(`💬 Transcription (${role}):`, text);
      addVoiceMessage(text, role);
    },
    [addVoiceMessage]
  );

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <ChatHeader
        onNewChat={handleNewChat}
        subjects={subjects}
        selectedSubject={getSelectedSubjectValue()}
        onSubjectChange={handleSubjectChange}
      />

      {/* Messages Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {hasMessages && (
          <div ref={scrollAreaRef} className="h-full">
            <ScrollArea className="h-full px-2 pt-2 pb-0">
              <div className="space-y-0">
                <ChatMessages
                  messages={messages}
                  isLoading={isLoading}
                  streamingContent={streamingContent}
                />
              </div>
            </ScrollArea>
          </div>
        )}
        {!hasMessages && (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-primary">
                What can I help with?
              </h1>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-2 pt-0 pb-2 bg-background">
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          disabled={!sessionId}
          hasMessages={hasMessages}
          studentId={studentId}
          sessionId={sessionId}
          studentName={studentProfile?.name}
          grade={studentProfile?.grade || undefined}
          subject={selectedSubject !== "all" ? selectedSubject : undefined}
          pendingAssignments={pendingAssignments}
          completedAssignments={completedAssignments}
          onTranscription={handleTranscription}
        />
      </div>
    </div>
  );
}

