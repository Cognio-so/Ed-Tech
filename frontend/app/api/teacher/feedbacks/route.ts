import { NextRequest, NextResponse } from "next/server";
import { getStudentFeedbacks } from "@/data/get-student-feedbacks";
import { requireTeacher } from "@/data/get-teacher";

export async function GET(request: NextRequest) {
  try {
    await requireTeacher();

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const result = await getStudentFeedbacks(page, pageSize);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in feedbacks API:", error);
    return NextResponse.json(
      { feedbacks: [], total: 0, totalPages: 0 },
      { status: 500 }
    );
  }
}

