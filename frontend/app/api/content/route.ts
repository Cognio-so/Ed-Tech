import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { protectRoute } from "@/lib/arcjet";

export async function GET(request: NextRequest) {
  const protection = await protectRoute(request);
  if (protection) return protection;

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contents = await prisma.content.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contents);
  } catch (error) {
    console.error("Error fetching contents:", error);
    return NextResponse.json([]);
  }
}

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
      contentType,
      title,
      content,
      grade,
      subject,
      topic,
      language,
      learningObjective,
      emotionalConsideration,
      adaptiveLearning,
      includeAssessment,
      multimediaSuggestion,
      instructionDepth,
      numberOfSessions,
      durationOfSession,
    } = body;

    const savedContent = await prisma.content.create({
      data: {
        userId: session.user.id,
        contentType,
        title: title || `${contentType} - ${topic || "Untitled"}`,
        content,
        grade,
        subject,
        topic,
        language,
        learningObjective,
        emotionalConsideration,
        adaptiveLearning,
        includeAssessment,
        multimediaSuggestion,
        instructionDepth,
        numberOfSessions,
        durationOfSession,
      },
    });

    return NextResponse.json(savedContent);
  } catch (error) {
    console.error("Error saving content:", error);
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}
