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
      const grades = await prisma.grade.findMany({
        orderBy: { name: "asc" },
      });
      return NextResponse.json(grades);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        grade: true,
      },
    });

    if (user?.role === "teacher") {
      if (user.grade) {
        return NextResponse.json([
          { id: user.grade.id, name: user.grade.name },
        ]);
      }
      return NextResponse.json([]);
    }

    const grades = await prisma.grade.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(grades);
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json(
      { error: "Failed to fetch grades" },
      { status: 500 }
    );
  }
}
