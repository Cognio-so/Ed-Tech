"use client";

import { HistoryData } from "./history-data";
import type { TeacherConversation } from "@/data/get-teacher-history";

interface HistoryListProps {
  conversations: TeacherConversation[];
  total: number;
  totalPages: number;
  currentPage: number;
  searchQuery?: string;
}

export function HistoryList({
  conversations,
  total,
  totalPages,
  currentPage,
  searchQuery,
}: HistoryListProps) {
  return (
    <HistoryData
      conversations={conversations}
      total={total}
      totalPages={totalPages}
      currentPage={currentPage}
      searchQuery={searchQuery}
    />
  );
}
