"use client";

import { HistoryData } from "./history-data";
import type { StudentConversation } from "@/data/get-student-history";

interface HistoryListProps {
  conversations: StudentConversation[];
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

