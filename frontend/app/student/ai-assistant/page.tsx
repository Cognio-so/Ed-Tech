import { getStudentProfile } from "@/data/get-student-profile";
import { getStudentStats } from "@/data/get-student-achievements";
import { getStudentAssignments } from "@/data/get-student-assignments";
import AIAssistantClient from "./_components/ai-assistant-client";

// Force dynamic rendering since we use headers() for authentication
export const dynamic = 'force-dynamic';

export default async function AIAssistantPage() {
  // Fetch data on the server side
  const [profile, stats, assignments] = await Promise.all([
    getStudentProfile(),
    getStudentStats(),
    getStudentAssignments(),
  ]);

  return (
    <AIAssistantClient 
      initialProfile={profile}
      initialStats={stats}
      initialAssignments={assignments}
    />
  );
}