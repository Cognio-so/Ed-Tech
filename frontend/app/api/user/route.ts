import { NextRequest, NextResponse } from "next/server";
import { getAllUsers } from "@/data/get-all-users";
import { protectRoute } from "@/lib/arcjet";

export async function GET(request: NextRequest) {
  const protection = await protectRoute(request);
  if (protection) return protection;

  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("search") || undefined;
    const roleFilter = searchParams.get("role") || undefined;

    const users = await getAllUsers(
      roleFilter && roleFilter !== "all" ? roleFilter : undefined,
      searchQuery
    );

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
