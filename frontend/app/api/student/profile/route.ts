import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        gradeId: true,
        grade: {
          select: {
            name: true,
          },
        },
        userSubjects: {
          select: {
            subject: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const subjects = user.userSubjects.map((us) => us.subject.name);

    return NextResponse.json({
      name: user.name,
      grade: user.grade?.name || null,
      subjects,
    });
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

