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
    const { contentType, ...formData } = body;

    const typeMap: Record<string, string> = {
      lesson_plan: "lesson_plan",
      presentation: "presentation",
      quiz: "quizz",
      worksheet: "worksheet",
    };

    const backendType = typeMap[contentType];
    if (!backendType) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 400 }
      );
    }

    if (
      !formData.grade ||
      !formData.subject ||
      !formData.language ||
      !formData.topic ||
      !formData.learningObjective
    ) {
      console.error("Missing required fields:", {
        grade: !!formData.grade,
        subject: !!formData.subject,
        language: !!formData.language,
        topic: !!formData.topic,
        learningObjective: !!formData.learningObjective,
      });
      return NextResponse.json(
        {
          error:
            "Missing required fields: grade, subject, language, topic, and learningObjective are required",
        },
        { status: 400 }
      );
    }

    const instructionDepthMap: Record<string, string> = {
      Basic: "Simple",
      Standard: "Standard",
      Advanced: "Enriched",
    };

    let numberOfSessions: number | null = null;
    if (formData.numberOfSessions && formData.numberOfSessions.trim() !== "") {
      const parsed = parseInt(formData.numberOfSessions, 10);
      if (!isNaN(parsed) && parsed > 0) {
        numberOfSessions = parsed;
      }
    }

    const sessionId = `session_${session.user.id}_${Date.now()}`;
    const teacherId = session.user.id;

    const backendPayload = {
      grade: formData.grade,
      subject: formData.subject,
      language: formData.language,
      topic: formData.topic,
      learning_objective: formData.learningObjective,
      emotional_consideration: formData.emotionalConsideration || 3,
      adaptive_learning: formData.adaptiveLearning || false,
      include_assessment: formData.includeAssessment || false,
      multimedia_suggestion: formData.multimediaSuggestion || false,
      instruction_depth:
        instructionDepthMap[formData.instructionDepth] || "Standard",
      number_of_sessions: numberOfSessions,
      duration_of_session: formData.durationOfSession || null,
    };

    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/content_generator/${backendType}?stream=true`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Backend error response:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
      });
      let errorMessage = "Failed to generate content";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail || errorJson.error || errorMessage;
        console.error("❌ Parsed error:", errorJson);
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 500 });
    }

    // Forward the stream directly without parsing - just extract content chunks
    const decoder = new TextDecoder();
    const textEncoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              // Process remaining buffer
              if (buffer) {
                const lines = buffer.split("\n");
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    const data = line.slice(6).trim();
                    if (!data) continue;
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.type === "content" && parsed.data?.chunk) {
                        controller.enqueue(textEncoder.encode(parsed.data.chunk));
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              }
              break;
            }

            // Decode chunk
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6).trim();
                if (!data) continue;
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Forward content chunks immediately
                  if (parsed.type === "content" && parsed.data?.chunk) {
                    controller.enqueue(textEncoder.encode(parsed.data.chunk));
                  }
                } catch (e) {
                  // Skip malformed data
                }
              }
            }
          }
          
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Error generating content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
