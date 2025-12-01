import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { contentType, ...formData } = body

    // Map content type to backend type (note: backend uses "quizz" not "quiz")
    const typeMap: Record<string, string> = {
      lesson_plan: "lesson_plan",
      presentation: "presentation",
      quiz: "quizz", // Backend uses "quizz"
      worksheet: "worksheet",
    }

    const backendType = typeMap[contentType]
    if (!backendType) {
      return NextResponse.json(
        { error: "Invalid content type" },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!formData.grade || !formData.subject || !formData.language || !formData.topic || !formData.learningObjective) {
      console.error("Missing required fields:", {
        grade: !!formData.grade,
        subject: !!formData.subject,
        language: !!formData.language,
        topic: !!formData.topic,
        learningObjective: !!formData.learningObjective,
      })
      return NextResponse.json(
        { error: "Missing required fields: grade, subject, language, topic, and learningObjective are required" },
        { status: 400 }
      )
    }

    // Map instruction depth from frontend values to backend enum values
    // Frontend: "Basic", "Standard", "Advanced"
    // Backend: "Simple", "Standard", "Enriched"
    const instructionDepthMap: Record<string, string> = {
      Basic: "Simple",
      Standard: "Standard",
      Advanced: "Enriched",
    }

    // Convert number_of_sessions from string to integer if provided
    let numberOfSessions: number | null = null
    if (formData.numberOfSessions && formData.numberOfSessions.trim() !== "") {
      const parsed = parseInt(formData.numberOfSessions, 10)
      if (!isNaN(parsed) && parsed > 0) {
        numberOfSessions = parsed
      }
    }

    // Generate a session ID (or use existing if available)
    const sessionId = `session_${session.user.id}_${Date.now()}`
    const teacherId = session.user.id

    // Transform form data to match backend ContentGenerationRequest schema (snake_case)
    const backendPayload = {
      grade: formData.grade,
      subject: formData.subject,
      language: formData.language,
      topic: formData.topic,
      learning_objective: formData.learningObjective, // Required field - must not be empty
      emotional_consideration: formData.emotionalConsideration || 3,
      adaptive_learning: formData.adaptiveLearning || false,
      include_assessment: formData.includeAssessment || false,
      multimedia_suggestion: formData.multimediaSuggestion || false,
      instruction_depth: instructionDepthMap[formData.instructionDepth] || "Standard",
      number_of_sessions: numberOfSessions,
      duration_of_session: formData.durationOfSession || null,
    }

    // Build the backend endpoint URL
    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/content_generator/${backendType}?stream=true`

    console.log("📤 Sending payload to backend:", {
      endpoint: endpoint,
      payload: backendPayload,
    })

    // Call backend API with streaming
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Backend error response:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
      })
      let errorMessage = "Failed to generate content"
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.error || errorMessage
        console.error("❌ Parsed error:", errorJson)
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

    // Stream the response (SSE format)
    const reader = response.body?.getReader()
    if (!reader) {
      return NextResponse.json(
        { error: "No response body" },
        { status: 500 }
      )
    }

    const decoder = new TextDecoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            
            // Parse SSE format: "data: {json}\n\n"
            const lines = chunk.split("\n")
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6) // Remove "data: " prefix
                try {
                  const parsed = JSON.parse(data)
                  // Extract content chunks from the SSE format
                  if (parsed.type === "content" && parsed.data?.chunk) {
                    // Forward the chunk as plain text for the frontend
                    const textEncoder = new TextEncoder()
                    controller.enqueue(textEncoder.encode(parsed.data.chunk))
                  }
                } catch (e) {
                  // If parsing fails, just forward the raw data
                  const textEncoder = new TextEncoder()
                  controller.enqueue(textEncoder.encode(data))
                }
              } else if (line.trim() && !line.startsWith(":")) {
                // Forward non-SSE lines as-is
                const textEncoder = new TextEncoder()
                controller.enqueue(textEncoder.encode(line + "\n"))
              }
            }
          }
          controller.close()
        } catch (error) {
          console.error("Stream error:", error)
          controller.error(error)
        }
      },
    })

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error generating content:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
