import { NextResponse } from "next/server";
import { getStudentProfile } from "@/data/get-student-profile";

export async function GET() {
  try {
    const profile = await getStudentProfile();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

