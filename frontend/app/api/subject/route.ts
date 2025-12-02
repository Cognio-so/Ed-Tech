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
      const subjects = await prisma.subject.findMany({
        orderBy: { name: "asc" },
      });
      return NextResponse.json(subjects);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        userSubjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (user?.role === "teacher") {
      if (user.userSubjects && user.userSubjects.length > 0) {
        const subjects = user.userSubjects.map((us) => ({
          id: us.subject.id,
          name: us.subject.name,
        }));
        return NextResponse.json(subjects);
      }
      return NextResponse.json([]);
    }

    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    );
  }
}
