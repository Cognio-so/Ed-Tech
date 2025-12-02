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

    const formData = await request.formData();
    const pptxFile = formData.get("pptxFile") as File;
    const voiceId = formData.get("voiceId") as string;
    const talkingPhotoId = formData.get("talkingPhotoId") as string;
    const title = formData.get("title") as string;
    const language = formData.get("language") as string;

    if (!pptxFile) {
      return NextResponse.json(
        { error: "PPTX file is required" },
        { status: 400 }
      );
    }

    const sessionId = `session_${session.user.id}_${Date.now()}`;
    const teacherId = session.user.id;

    const backendFormData = new FormData();
    backendFormData.append("pptx_file", pptxFile);
    backendFormData.append("voice_id", voiceId);
    backendFormData.append("talking_photo_id", talkingPhotoId);
    backendFormData.append("title", title);
    backendFormData.append("language", language);

    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/video_generation/generate`;

    const response = await fetch(endpoint, {
      method: "POST",
      body: backendFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to generate video";
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
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
