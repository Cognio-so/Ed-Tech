import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string; sessionId: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { teacherId, sessionId } = await params;
    const body = await request.json();

    console.log("📦 Connect request for:", { teacherId, sessionId });

    // Forward to FastAPI backend
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const endpoint = `${backendUrl}/api/teacher/${teacherId}/session/${sessionId}/voice_agent/connect`;

    console.log("🔄 Proxying voice connect request to:", endpoint);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Backend error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log("✅ Voice connect successful");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("💥 Proxy error:", error);
    return NextResponse.json(
      { detail: error.message || "Failed to connect" },
      { status: 500 }
    );
  }
}
