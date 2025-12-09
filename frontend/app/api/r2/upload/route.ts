import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import r2 from "@/lib/S3Client";
import { requireUser } from "@/data/requireUser";
import { protectRoute } from "@/lib/arcjet";

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function POST(req: NextRequest) {
  const protection = await protectRoute(req);
  if (protection) {
    return protection;
  }

  const { user } = await requireUser();

  try {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType } = await req.json();

    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Check MIME type if provided
    const hasValidMimeType = fileType && (
      fileType.startsWith("image/") || 
      fileType.startsWith("application/pdf") || 
      fileType.startsWith("application/msword") || 
      fileType.startsWith("application/vnd.openxmlformats-officedocument.wordprocessingml.document") || 
      fileType.startsWith("text/markdown") || 
      fileType.startsWith("application/json") ||
      fileType.startsWith("text/plain") ||
      fileType.startsWith("text/javascript") ||
      fileType.startsWith("application/javascript") ||
      fileType.startsWith("text/x-python") ||
      fileType.startsWith("text/typescript") ||
      fileType.startsWith("text/x-c++src") ||
      fileType.startsWith("text/x-csrc") ||
      fileType.startsWith("text/x-c") ||
      fileType.startsWith("text/html") ||
      fileType.startsWith("text/css")
    );

    // Check file extension as fallback (for files with empty or unrecognized MIME types)
    const fileNameLower = fileName.toLowerCase();
    const codeExtensions = [".py", ".js", ".ts", ".tsx", ".jsx", ".cpp", ".c", ".cc", ".cxx", ".h", ".hpp", ".java", ".rb", ".go", ".rs", ".php", ".swift", ".kt", ".scala", ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd", ".html", ".htm", ".css"];
    const hasValidExtension = fileNameLower.endsWith(".md") ||
      fileNameLower.endsWith(".markdown") ||
      fileNameLower.endsWith(".pdf") ||
      fileNameLower.endsWith(".doc") ||
      fileNameLower.endsWith(".docx") ||
      fileNameLower.endsWith(".json") ||
      fileNameLower.endsWith(".txt") ||
      codeExtensions.some(ext => fileNameLower.endsWith(ext)) ||
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

    if (!hasValidMimeType && !hasValidExtension) {
      return NextResponse.json(
        { error: "Only images, PDFs, Word docs, Markdown, JSON, text files, code files (including HTML/CSS) allowed" },
        { status: 400 }
      );
    }

    // Use provided fileType or infer from extension
    let contentType = fileType || "application/octet-stream";
    if (!fileType || fileType === "" || fileType === "application/octet-stream") {
      if (fileNameLower.endsWith(".md") || fileNameLower.endsWith(".markdown")) {
        contentType = "text/markdown";
      } else if (fileNameLower.endsWith(".pdf")) {
        contentType = "application/pdf";
      } else if (fileNameLower.endsWith(".doc")) {
        contentType = "application/msword";
      } else if (fileNameLower.endsWith(".docx")) {
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (fileNameLower.endsWith(".json")) {
        contentType = "application/json";
      } else if (fileNameLower.endsWith(".txt")) {
        contentType = "text/plain";
      } else if (fileNameLower.endsWith(".html") || fileNameLower.endsWith(".htm")) {
        contentType = "text/html";
      } else if (fileNameLower.endsWith(".css")) {
        contentType = "text/css";
      } else if (fileNameLower.endsWith(".py")) {
        contentType = "text/x-python";
      } else if (fileNameLower.endsWith(".js") || fileNameLower.endsWith(".jsx")) {
        contentType = "text/javascript";
      } else if (fileNameLower.endsWith(".ts") || fileNameLower.endsWith(".tsx")) {
        contentType = "text/typescript";
      } else if (fileNameLower.endsWith(".cpp") || fileNameLower.endsWith(".cc") || fileNameLower.endsWith(".cxx") || fileNameLower.endsWith(".hpp")) {
        contentType = "text/x-c++src";
      } else if (fileNameLower.endsWith(".c") || fileNameLower.endsWith(".h")) {
        contentType = "text/x-csrc";
      } else if (/\.(jpg|jpeg)$/i.test(fileName)) {
        contentType = "image/jpeg";
      } else if (fileNameLower.endsWith(".png")) {
        contentType = "image/png";
      } else if (fileNameLower.endsWith(".gif")) {
        contentType = "image/gif";
      } else if (fileNameLower.endsWith(".webp")) {
        contentType = "image/webp";
      } else if (fileNameLower.endsWith(".svg")) {
        contentType = "image/svg+xml";
      } else {
        // Default to text/plain for other code files
        contentType = "text/plain";
      }
    }

    const key = `${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(r2, command, { expiresIn: 60 });

    return NextResponse.json({
      uploadUrl: signedUrl,
      fileUrl: `${PUBLIC_URL}/${key}`,
      key,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to create presigned URL" },
      { status: 500 }
    );
  }
}
