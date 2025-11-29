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
    const {
      subject,
      grade,
      difficultyLevel,
      language,
      topic,
      learningObjective,
      duration,
      confidenceLevel,
      customInstruction,
      mcqEnabled,
      mcqCount,
      trueFalseEnabled,
      trueFalseCount,
      shortAnswerEnabled,
      shortAnswerCount,
    } = body

    const backendPayload = {
      subject,
      grade,
      difficulty_level: difficultyLevel,
      language,
      topic,
      learning_objective: learningObjective,
      duration,
      confidence_level: confidenceLevel,
      custom_instruction: customInstruction || "",
      mcq_enabled: mcqEnabled || false,
      mcq_count: mcqCount || 0,
      true_false_enabled: trueFalseEnabled || false,
      true_false_count: trueFalseCount || 0,
      short_answer_enabled: shortAnswerEnabled || false,
      short_answer_count: shortAnswerCount || 0,
    }

    const sessionId = `session_${session.user.id}_${Date.now()}`
    const teacherId = session.user.id

    const endpoint = `${BACKEND_URL}/api/session/${sessionId}/teacher/${teacherId}/assessment?stream=true`

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Failed to generate assessment"
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.detail || errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      )
    }

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
            
            const lines = chunk.split("\n")
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6)
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.type === "content" && parsed.data?.chunk) {
                    const textEncoder = new TextEncoder()
                    controller.enqueue(textEncoder.encode(parsed.data.chunk))
                  }
                } catch (e) {
                  const textEncoder = new TextEncoder()
                  controller.enqueue(textEncoder.encode(data))
                }
              } else if (line.trim() && !line.startsWith(":")) {
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
    console.error("Error generating assessment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

