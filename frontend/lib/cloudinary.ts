/**
 * Cloudinary utility functions for uploading images
 * Uses server-side API route for secure uploads
 */

/**
 * Uploads a base64 image or image URL to Cloudinary via server-side API
 * @param imageData - Base64 data URL or image URL
 * @param publicId - Optional public ID for the image (auto-generated if not provided)
 * @returns Promise with Cloudinary URL
 */
export async function uploadToCloudinary(
  imageData: string,
  publicId?: string
): Promise<string> {
  // If it's already a Cloudinary URL, return as is
  if (imageData.includes("cloudinary.com")) {
    return imageData;
  }

  // Use server-side API route for secure upload
  try {
    const response = await fetch("/api/cloudinary/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageData: imageData.startsWith("http://") || imageData.startsWith("https://") 
          ? undefined 
          : imageData,
        imageUrl: imageData.startsWith("http://") || imageData.startsWith("https://")
          ? imageData
          : undefined,
        publicId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to upload image");
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
}

/**
 * Uploads multiple images in parallel
 * @param images - Array of base64 data URLs or image URLs
 * @param publicIdPrefix - Optional prefix for public IDs
 * @returns Promise with array of Cloudinary URLs in the same order
 */
export async function uploadMultipleToCloudinary(
  images: string[],
  publicIdPrefix?: string
): Promise<string[]> {
  const timestamp = Date.now();
  const uploadPromises = images.map((image, index) => {
    const publicId = publicIdPrefix
      ? `${publicIdPrefix}_${index}`
      : `image_${timestamp}_${index}_${Math.random().toString(36).substring(7)}`;
    return uploadToCloudinary(image, publicId);
  });

  return Promise.all(uploadPromises);
}

