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
      instructions,
      gradeLevel,
      numPanels,
      language,
    } = body

    const backendPayload = {
      instructions,
      grade_level: gradeLevel,
      num_panels: numPanels,
      language,
    }

    const sessionId = `session_${session.user.id}_${Date.now()}`
    const teacherId = session.user.id

    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/comic_generation`

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Failed to generate comic"
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
                  const textEncoder = new TextEncoder()
                  controller.enqueue(textEncoder.encode(JSON.stringify(parsed) + "\n"))
                } catch (e) {
                  const textEncoder = new TextEncoder()
                  controller.enqueue(textEncoder.encode(data + "\n"))
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
    console.error("Error generating comic:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

