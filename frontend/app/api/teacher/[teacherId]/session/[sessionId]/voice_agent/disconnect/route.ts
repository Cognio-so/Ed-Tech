import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string; sessionId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { teacherId, sessionId } = await params;

    console.log("📦 Disconnect request for:", { teacherId, sessionId });

    // Forward to FastAPI backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const endpoint = `${backendUrl}/api/teacher/${teacherId}/session/${sessionId}/voice_agent/disconnect`;

    console.log("🔄 Proxying voice disconnect request to:", endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("✅ Voice disconnect successful");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("💥 Proxy error:", error);
    return NextResponse.json(
      { detail: error.message || "Failed to disconnect" },
      { status: 500 }
    );
  }
}
