import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "application/json",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only PDF, DOCX, DOC, TXT, and JSON files are allowed.",
        },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split(".").pop();
    const filename = `${session.user.id}_${timestamp}_${randomString}.${fileExtension}`;
    const filepath = join(UPLOAD_DIR, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const fileUrl = `/uploads/${filename}`;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
    const absoluteUrl = `${baseUrl}${fileUrl}`;

    return NextResponse.json({
      success: true,
      url: absoluteUrl,
      fileUrl: absoluteUrl,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
