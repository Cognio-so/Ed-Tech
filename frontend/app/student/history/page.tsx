import { getStudentHistory } from "@/data/get-student-history";
import { HistoryList } from "./_components/history-list";

interface HistoryPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

export default async function StudentHistoryPage({
  searchParams,
}: HistoryPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const searchQuery = params.search || "";
  const pageSize = 10;

  const { conversations, total, totalPages } = await getStudentHistory(
    page,
    pageSize,
    searchQuery
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">
          Conversation History
        </h1>
        <p className="text-muted-foreground mt-1">
          {total} {total === 1 ? "conversation" : "conversations"} found
        </p>
      </div>

      <HistoryList
        conversations={conversations}
        total={total}
        totalPages={totalPages}
        currentPage={page}
        searchQuery={searchQuery}
      />
    </div>
  );
}
