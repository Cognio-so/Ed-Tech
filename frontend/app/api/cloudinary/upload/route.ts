import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Server-side API route for uploading images to Cloudinary
 * Uses server-side environment variables for security
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { imageData, imageUrl, publicId } = body;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary credentials not configured" },
        { status: 500 }
      );
    }

    // If imageUrl is provided, fetch it first
    let imageToUpload: string;
    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error("Failed to fetch image");
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageToUpload = buffer.toString("base64");
      } catch (error) {
        return NextResponse.json(
          { error: "Failed to fetch image from URL" },
          { status: 400 }
        );
      }
    } else if (imageData) {
      // Handle base64 data
      if (imageData.startsWith("data:image")) {
        imageToUpload = imageData.split(",")[1] || imageData;
      } else {
        imageToUpload = imageData;
      }
    } else {
      return NextResponse.json(
        { error: "Either imageData or imageUrl must be provided" },
        { status: 400 }
      );
    }

    // Generate public ID if not provided
    const finalPublicId =
      publicId || `image_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Generate signature for authenticated upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signatureString = `public_id=${finalPublicId}&timestamp=${timestamp}${apiSecret}`;
    const crypto = await import("crypto");
    const signature = crypto
      .createHash("sha1")
      .update(signatureString)
      .digest("hex");

    // Create form data for Cloudinary upload
    const formData = new FormData();
    formData.append("file", `data:image/png;base64,${imageToUpload}`);
    formData.append("public_id", finalPublicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);

    // Upload to Cloudinary
    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!cloudinaryResponse.ok) {
      const error = await cloudinaryResponse.text();
      console.error("Cloudinary upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload to Cloudinary" },
        { status: 500 }
      );
    }

    const data = await cloudinaryResponse.json();
    return NextResponse.json({
      secure_url: data.secure_url,
      public_id: data.public_id,
    });
  } catch (error) {
    console.error("Error in Cloudinary upload API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

