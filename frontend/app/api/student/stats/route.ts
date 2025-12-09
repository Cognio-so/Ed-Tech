import { NextResponse } from "next/server";
import { getStudentStats } from "@/data/get-student-achievements";

export async function GET() {
  try {
    const stats = await getStudentStats();

    if (!stats) {
      return NextResponse.json({ error: "Stats not found" }, { status: 404 });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching student stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

