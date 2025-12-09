"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAITutor } from "@/hooks/use-ai-tutor";
import { ChatInput } from "./_components/chat-input";
import { ChatMessages } from "./_components/chat-message";
import { ChatHeader } from "./_components/chat-header";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface TeacherStats {
  name: string;
  grades: string[];
  subjects: string[];
  totalContent: number;
  totalAssessments: number;
  totalStudents: number;
  students: Array<{
    id: string;
    name: string;
    grade: string | null;
    performance: string | null;
    achievements: string | null;
    feedback: string | null;
    issues: string | null;
  }>;
}

export default function AITutorPage() {
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [sessionId, setSessionId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");

  // Use refs to always get the latest values when sending messages
  const teacherStatsRef = useRef<TeacherStats | null>(null);
  const topicRef = useRef<string>("");
  const subjectRef = useRef<string>("");
  const selectedSubjectRef = useRef<string>("");
  const selectedGradesRef = useRef<string[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    teacherStatsRef.current = teacherStats;
  }, [teacherStats]);

  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    selectedSubjectRef.current = selectedSubject;
  }, [selectedSubject]);

  useEffect(() => {
    selectedGradesRef.current = selectedGrades;
  }, [selectedGrades]);

  const {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearMessages,
    addVoiceMessage,
  } = useAITutor({ sessionId });

  const hasMessages = messages.length > 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get current user session
        const sessionData = await authClient.getSession();
        if (sessionData?.data?.user?.id) {
          const tId = sessionData.data.user.id;
          setTeacherId(tId);

          try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
            if (!backendUrl) {
              console.error("Backend URL not configured");
              return;
            }
            
            const sessRes = await fetch(`${backendUrl}/api/teacher/${tId}/sessions`, {
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

        const response = await fetch("/api/teacher/stats");
        if (response.ok) {
          const stats = await response.json();
          setTeacherStats(stats);

          if (stats.grades && stats.grades.length > 0) {
            const gradeList = stats.grades.map(
              (name: string, index: number) => ({
                id: `grade-${index}`,
                name,
              })
            );
            setGrades(gradeList);
            if (gradeList.length > 0) {
              setSelectedGrades([gradeList[0].name]);
            }
          }

          if (stats.subjects && stats.subjects.length > 0) {
            const subjectList = stats.subjects.map(
              (name: string, index: number) => ({
                id: `subject-${index}`,
                name,
              })
            );
            setSubjects(subjectList);
          }
        }
      } catch (error) {
        console.error("Error fetching teacher stats:", error);
      }
    }
    fetchStats();
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
      // Use refs to get the latest values instead of stale closure values
      const currentStats = teacherStatsRef.current;
      const currentTopic = topicRef.current;
      const currentSubject = subjectRef.current;
      const currentSelectedSubject = selectedSubjectRef.current;
      const currentSelectedGrades = selectedGradesRef.current;

      const teacherData = currentStats
        ? {
          name: currentStats.name,
          grades:
            currentSelectedGrades.length > 0 ? currentSelectedGrades : currentStats.grades,
          subjects: currentStats.subjects,
          total_content: currentStats.totalContent,
          total_assessments: currentStats.totalAssessments,
          total_students: currentStats.totalStudents,
          students: currentStats.students.map((student) => ({
            name: student.name,
            grade: student.grade,
            performance: student.performance,
            achievements: student.achievements,
            feedback: student.feedback,
            issues: student.issues,
          })),
        }
        : undefined;

      const finalSubject =
        currentSelectedSubject &&
          currentSelectedSubject !== "all" &&
          currentSelectedSubject.trim() !== ""
          ? currentSelectedSubject
          : currentSubject && currentSubject !== "all" && currentSubject.trim() !== ""
            ? currentSubject
            : undefined;

      await sendMessage(message, {
        teacherData,
        topic: currentTopic || undefined,
        subject: finalSubject,
        docUrl: options?.docUrl,
        uploadedDocs: options?.uploadedDocs,
        language: "English",
        model: options?.model,
      });
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    clearMessages();
    toast.success("Chat history cleared");
  }, [clearMessages]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setTopic("");
    setSubject("");
    if (teacherStats?.grades && teacherStats.grades.length > 0) {
      setSelectedGrades([teacherStats.grades[0]]);
    } else {
      setSelectedGrades([]);
    }
    setSelectedSubject("");
  }, [clearMessages, teacherStats]);

  const handleGradeChange = useCallback((grades: string[]) => {
    setSelectedGrades(grades);
  }, []);

  const handleSubjectChange = useCallback((subject: string) => {
    setSelectedSubject(subject);
    setSubject(subject);
  }, []);

  const getSelectedSubjectValue = () => {
    return selectedSubject || "all";
  };

  const handleTranscription = useCallback(
    (text: string, role: "user" | "assistant") => {
      // Add transcription as a message in the chat
      console.log(`💬 Transcription (${role}):`, text);
      addVoiceMessage(text, role);
    },
    [addVoiceMessage]
  );

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <ChatHeader
        onNewChat={handleNewChat}
        grades={grades}
        subjects={subjects}
        selectedGrades={selectedGrades}
        selectedSubject={getSelectedSubjectValue()}
        onGradeChange={handleGradeChange}
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
          teacherId={teacherId}
          sessionId={sessionId}
          teacherName={teacherStats?.name}
          onTranscription={handleTranscription}
        />
      </div>
    </div>
  );
}
