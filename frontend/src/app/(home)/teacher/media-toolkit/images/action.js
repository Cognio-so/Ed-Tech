"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import PythonApiClient from "@/lib/PythonApi";
import { ObjectId } from "mongodb";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function generateImage(imageData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    console.log('Starting image generation request:', imageData);
    const result = await PythonApiClient.generateImage(imageData);

    if (result.image_url) {
      return {
        success: true,
        image: result,
        message: "Image generation completed successfully"
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to generate image"
      };
    }
  } catch (error) {
    console.error("Error generating image:", error);
    return {
      success: false,
      error: error.message || "Failed to generate image"
    };
  }
}

export async function uploadImageToCloudinaryAndSave(imageData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    // Upload base64 image to Cloudinary
    const uploadResult = await uploadImageToCloudinary(imageData.imageBase64, 'ai-images');
    
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || "Failed to upload image to Cloudinary"
      };
    }

    // Save to database with Cloudinary URL - OPTIMIZED: Don't store base64 in DB
    const { db } = await connectToDatabase();
    const imagesCollection = db.collection("images");

    const imageDocument = {
      userId: session.user.id,
      title: imageData.title,
      topic: imageData.topic,
      subject: imageData.subject,
      grade: imageData.grade,
      instructions: imageData.instructions,
      visualType: imageData.visualType,
      language: imageData.language,
      difficultyFlag: imageData.difficultyFlag || false,
      imageUrl: uploadResult.url, // Cloudinary URL
      cloudinaryPublicId: uploadResult.publicId, // Store Cloudinary public ID for future operations
      // REMOVED: imageBase64: imageData.imageBase64, // Don't store base64 in database
      status: 'completed',
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: imageData.tags || [],
        isPublic: imageData.isPublic || false,
        downloadCount: 0,
        viewCount: 0
      }
    };

    const result = await imagesCollection.insertOne(imageDocument);

    return {
      success: true,
      imageId: result.insertedId.toString(),
      cloudinaryUrl: uploadResult.url,
      message: "Image uploaded to Cloudinary and saved to database successfully"
    };
  } catch (error) {
    console.error("Error uploading and saving image:", error);
    return {
      success: false,
      error: error.message || "Failed to upload and save image"
    };
  }
}

export async function getUserImages(userId = null) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const imagesCollection = db.collection("images");

    const query = userId ? { userId: userId } : { userId: session.user.id };
    const images = await imagesCollection
      .find(query)
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    const serializedImages = images.map(image => ({
      ...image,
      _id: image._id.toString(),
      userId: image.userId.toString()
    }));

    return {
      success: true,
      images: serializedImages
    };
  } catch (error) {
    console.error("Error fetching images:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch images"
    };
  }
}

export async function deleteImageFromDatabase(imageId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const imagesCollection = db.collection("images");

    const result = await imagesCollection.deleteOne({
      _id: new ObjectId(imageId),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Image not found or you don't have permission to delete it"
      };
    }

    return {
      success: true,
      message: "Image deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting image:", error);
    return {
      success: false,
      error: error.message || "Failed to delete image"
    };
  }
}

export async function updateImageInDatabase(imageId, updateData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const imagesCollection = db.collection("images");

    const result = await imagesCollection.updateOne(
      {
        _id: new ObjectId(imageId),
        userId: session.user.id
      },
      {
        $set: {
          ...updateData,
          "metadata.updatedAt": new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Image not found or you don't have permission to update it"
      };
    }

    return {
      success: true,
      message: "Image updated successfully"
    };
  } catch (error) {
    console.error("Error updating image:", error);
    return {
      success: false,
      error: error.message || "Failed to update image"
    };
  }
}

// Get user's assigned grades and subjects
export async function getUserAssignedGradesAndSubjects() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      success: true,
      grades: user.grades || [],
      subjects: user.subjects || []
    };
  } catch (error) {
    console.error("Error fetching user grades and subjects:", error);
    return {
      success: false,
      grades: [],
      subjects: [],
      error: error.message || "Failed to fetch user data"
    };
  }
}
