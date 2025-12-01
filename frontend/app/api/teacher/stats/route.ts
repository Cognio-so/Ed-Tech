import { NextResponse } from "next/server";
import { getTeacherStats } from "@/data/get-teacher-stats";

export async function GET() {
  try {
    const stats = await getTeacherStats();
    
    if (!stats) {
      return NextResponse.json(
        { error: "Teacher stats not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching teacher stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch teacher stats" },
      { status: 500 }
    );
  }
}

