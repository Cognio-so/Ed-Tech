"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useStudentAITutor } from "@/hooks/use-student-ai-tutor";
import { ChatInput } from "./ai-chat-input";
import { ChatMessages } from "./ai-chat-message";
import { ChatHeader } from "./ai-chat-header";
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

interface AIAssistantClientProps {
  initialProfile: any;
  initialStats: any;
  initialAssignments: any;
}

function AIAssistantClient({
  initialProfile,
  initialStats,
  initialAssignments,
}: AIAssistantClientProps) {
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null
  );
  const [topic, setTopic] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>(
    []
  );
  const [sessionId, setSessionId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [pendingAssignments, setPendingAssignments] = useState<
    Array<Record<string, any>>
  >([]);
  const [completedAssignments, setCompletedAssignments] = useState<
    Array<Record<string, any>>
  >([]);

  // Track if session creation has been attempted to prevent duplicates
  const sessionCreationAttemptedRef = useRef<boolean>(false);

  // Use refs to always get the latest values when sending messages
  const studentProfileRef = useRef<StudentProfile | null>(null);
  const pendingAssignmentsRef = useRef<Array<Record<string, any>>>([]);
  const completedAssignmentsRef = useRef<Array<Record<string, any>>>([]);
  const topicRef = useRef<string>("");
  const subjectRef = useRef<string>("");
  const selectedSubjectRef = useRef<string>("");

  // Keep refs in sync with state
  useEffect(() => {
    studentProfileRef.current = studentProfile;
  }, [studentProfile]);

  useEffect(() => {
    pendingAssignmentsRef.current = pendingAssignments;
  }, [pendingAssignments]);

  useEffect(() => {
    completedAssignmentsRef.current = completedAssignments;
  }, [completedAssignments]);

  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  useEffect(() => {
    subjectRef.current = subject;
  }, [subject]);

  useEffect(() => {
    selectedSubjectRef.current = selectedSubject;
  }, [selectedSubject]);

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

  // Function to create a new session from backend
  const createNewSession = useCallback(async () => {
    try {
      const sessionData = await authClient.getSession();
      if (sessionData?.data?.user?.id) {
        const sId = sessionData.data.user.id;
        setStudentId(sId);

        try {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
          if (!backendUrl) {
            console.error("Backend URL not configured");
            toast.error("Backend URL not configured");
            return;
          }

          const sessRes = await fetch(
            `${backendUrl}/api/student/${sId}/sessions`,
            {
              method: "POST",
            }
          );

          if (sessRes.ok) {
            const sessData = await sessRes.json();
            if (sessData.session_id) {
              console.log(
                "✅ New session created by backend:",
                sessData.session_id
              );
              setSessionId(sessData.session_id);
              toast.success("New chat session started");
              return sessData.session_id;
            } else {
              console.error("❌ Backend did not return session_id");
              toast.error("Failed to create session");
            }
          } else {
            const errorText = await sessRes.text();
            console.error(
              "❌ Failed to create session:",
              sessRes.status,
              errorText
            );
            toast.error("Failed to create session");
          }
        } catch (e) {
          console.error("❌ Error creating session:", e);
          toast.error("Error creating session");
        }
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error("Error creating session");
    }
    return null;
  }, []);

  // Session creation - only run once on mount
  useEffect(() => {
    async function createSession() {
      // Prevent creating a new session if we've already attempted to create one
      if (sessionCreationAttemptedRef.current) {
        console.log("✅ Session creation already attempted, skipping");
        return;
      }

      sessionCreationAttemptedRef.current = true;
      await createNewSession();
    }
    createSession();
  }, [createNewSession]); // Only run once on mount

  // Data initialization - can run when props change
  useEffect(() => {
    // Use the server-fetched data
    if (initialProfile) {
      setStudentProfile({
        name: initialProfile.name || "Student",
        grade: initialProfile.grade || null,
        subjects: initialProfile.subjects || [],
        achievements: initialProfile.achievements || [],
        totalScore: initialProfile.totalScore || 0,
        currentTier: initialProfile.currentTier || "starter",
      });

      if (initialProfile.subjects && initialProfile.subjects.length > 0) {
        const subjectList = initialProfile.subjects.map(
          (name: string, index: number) => ({
            id: `subject-${index}`,
            name,
          })
        );
        setSubjects(subjectList);
      }
    }

    if (initialStats) {
      if (initialStats.achievement) {
        const unlockedTiers =
          typeof initialStats.achievement.unlockedTiers === "string"
            ? JSON.parse(initialStats.achievement.unlockedTiers)
            : initialStats.achievement.unlockedTiers || [];

        setStudentProfile((prev) => ({
          ...prev!,
          achievements: unlockedTiers,
          totalScore: initialStats.achievement.totalScore || 0,
          currentTier: initialStats.achievement.currentTier || "starter",
        }));
      }
    }

    if (initialAssignments) {
      setPendingAssignments(initialAssignments.pending);
      setCompletedAssignments(initialAssignments.completed);
    }
  }, [initialProfile, initialStats, initialAssignments]);

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
      const currentProfile = studentProfileRef.current;
      const currentPendingAssignments = pendingAssignmentsRef.current;
      const currentCompletedAssignments = completedAssignmentsRef.current;
      const currentTopic = topicRef.current;
      const currentSubject = subjectRef.current;
      const currentSelectedSubject = selectedSubjectRef.current;

      const studentProfileData = currentProfile
        ? {
            name: currentProfile.name,
            grade: currentProfile.grade,
            subjects: currentProfile.subjects,
            achievements: currentProfile.achievements,
            totalScore: currentProfile.totalScore,
            currentTier: currentProfile.currentTier,
          }
        : undefined;

      const finalSubject =
        currentSelectedSubject &&
        currentSelectedSubject !== "all" &&
        currentSelectedSubject.trim() !== ""
          ? currentSelectedSubject
          : currentSubject &&
            currentSubject !== "all" &&
            currentSubject.trim() !== ""
          ? currentSubject
          : undefined;

      // Filter completed assignments by topic/subject if specified
      const filterAssignmentsByTopicSubject = (
        assignments: Array<Record<string, any>>
      ) => {
        if (!assignments || assignments.length === 0) return assignments;

        const topicToMatch = currentTopic?.toLowerCase().trim();
        const subjectToMatch = finalSubject?.toLowerCase().trim();

        if (!topicToMatch && !subjectToMatch) return assignments;

        return assignments.filter((assignment) => {
          const assignmentTopic = assignment.topic?.toLowerCase().trim();
          const assignmentSubject = assignment.subject?.toLowerCase().trim();

          // Match by topic if specified
          if (topicToMatch && assignmentTopic) {
            if (
              assignmentTopic.includes(topicToMatch) ||
              topicToMatch.includes(assignmentTopic)
            ) {
              return true;
            }
          }

          // Match by subject if specified
          if (subjectToMatch && assignmentSubject) {
            if (
              assignmentSubject.includes(subjectToMatch) ||
              subjectToMatch.includes(assignmentSubject)
            ) {
              return true;
            }
          }

          return false;
        });
      };

      // Filter completed assignments relevant to current topic/subject
      const relevantCompletedAssignments = filterAssignmentsByTopicSubject(
        currentCompletedAssignments
      );

      // Also filter pending assignments for context
      const relevantPendingAssignments = filterAssignmentsByTopicSubject(
        currentPendingAssignments
      );

      // Log what we're sending for debugging
      console.log("📚 Student AI Tutor - Sending completed assessments:", {
        currentTopic: currentTopic,
        finalSubject: finalSubject,
        totalCompletedAssignments: currentCompletedAssignments.length,
        relevantCompletedAssignments: relevantCompletedAssignments.length,
        completedAssignmentsData:
          relevantCompletedAssignments.length > 0
            ? relevantCompletedAssignments
            : currentCompletedAssignments,
      });

      await sendMessage(message, {
        studentProfile: studentProfileData,
        pendingAssignments:
          relevantPendingAssignments.length > 0
            ? relevantPendingAssignments
            : currentPendingAssignments,
        completedAssignments:
          relevantCompletedAssignments.length > 0
            ? relevantCompletedAssignments
            : currentCompletedAssignments,
        achievements: currentProfile?.achievements,
        topic: currentTopic || undefined,
        subject: finalSubject,
        docUrl: options?.docUrl,
        uploadedDocs: options?.uploadedDocs,
        model: options?.model,
      });
    },
    [sendMessage]
  );

  const handleClear = useCallback(() => {
    clearMessages();
    toast.success("Chat history cleared");
  }, [clearMessages]);

  const handleNewChat = useCallback(async () => {
    // Clear messages first
    clearMessages();
    
    // Reset form fields
    setTopic("");
    setSubject("");
    setSelectedSubject("");
    
    // Create a new session from backend
    await createNewSession();
  }, [clearMessages, createNewSession]);

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

export default AIAssistantClient;
