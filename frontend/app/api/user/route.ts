import { NextResponse } from "next/server";
import { getAllUsers } from "@/data/get-all-users";

export async function GET(request: Request) {
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