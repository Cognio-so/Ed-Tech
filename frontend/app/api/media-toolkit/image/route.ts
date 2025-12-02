import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { protectRoute } from "@/lib/arcjet";

const BACKEND_URL = process.env.BACKEND_URL;

export async function POST(request: NextRequest) {
  const protection = await protectRoute(request);
  if (protection) return protection;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      topic,
      gradeLevel,
      preferredVisualType,
      subject,
      instructions,
      difficultyFlag,
      language,
    } = body;

    const backendPayload = {
      topic,
      grade_level: gradeLevel,
      preferred_visual_type: preferredVisualType,
      subject,
      instructions,
      difficulty_flag: difficultyFlag || "false",
      language,
    };

    const sessionId = `session_${session.user.id}_${Date.now()}`;
    const teacherId = session.user.id;

    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/image_generation`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to generate image";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
