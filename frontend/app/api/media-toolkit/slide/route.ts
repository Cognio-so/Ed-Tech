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
      plainText,
      customUserInstructions,
      length,
      language,
      fetchImages,
      verbosity,
      tone,
      template,
    } = body

    const backendPayload = {
      plain_text: plainText,
      custom_user_instructions: customUserInstructions || "",
      length,
      language: language.toUpperCase(),
      fetch_images: fetchImages !== false,
      verbosity,
      tone,
      template,
    }

    const sessionId = `session_${session.user.id}_${Date.now()}`
    const teacherId = session.user.id

    const endpoint = `${BACKEND_URL}/api/teacher/${teacherId}/session/${sessionId}/presentation_slidespeak`

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backendPayload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = "Failed to generate slide presentation"
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

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error generating slide:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

