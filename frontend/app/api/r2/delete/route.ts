import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import r2 from "@/lib/S3Client";
import { requireUser } from "@/data/requireUser";
import { protectRoute } from "@/lib/arcjet";

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function DELETE(req: NextRequest) {
  const protection = await protectRoute(req);
  if (protection) {
    return protection;
  }

  const { user } = await requireUser();
  try {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { key } = await req.json();

    if (!key) {
      return NextResponse.json({ error: "File key required" }, { status: 400 });
    }

    await r2.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
      })
    );

    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
