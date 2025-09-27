"use server";

import PythonApiClient from "@/lib/PythonApi";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { getServerSession } from "@/lib/get-session";

export async function generateComic(formData) {
  try {
    console.log("Comic generation request:", formData);
    
    // Instead of returning the Response object, we'll return the data needed to start the stream
    return {
      success: true,
      message: "Comic generation started",
      formData: formData
    };
  } catch (error) {
    console.error("Comic generation error:", error);
    throw new Error(error.message || "Failed to generate comic");
  }
}

// NEW: Function to save comic with pre-uploaded Cloudinary URLs (no base64 processing)
export async function saveComicWithCloudinaryUrls(comicData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const collection = db.collection("comics");

    // Create a title from the instruction (first 50 characters)
    const title = comicData.instructions 
      ? comicData.instructions.substring(0, 50) + (comicData.instructions.length > 50 ? '...' : '')
      : 'Untitled Comic';

    const comicDoc = {
      userId: new ObjectId(session.user.id),
      title: title,
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      comicType: comicData.comicType || "educational",
      imageUrls: comicData.imageUrls, // Cloudinary URLs only
      cloudinaryPublicIds: comicData.cloudinaryPublicIds, // Cloudinary public IDs
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [comicData.subject, comicData.gradeLevel, comicData.language],
        isPublic: false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "completed"
    };

    const result = await collection.insertOne(comicDoc);
    
    // Properly serialize the comic object for client components
    const serializedComic = {
      _id: result.insertedId.toString(),
      userId: session.user.id,
      title: title,
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      comicType: comicData.comicType || "educational",
      imageUrls: comicData.imageUrls,
      cloudinaryPublicIds: comicData.cloudinaryPublicIds,
      metadata: {
        createdAt: comicDoc.metadata.createdAt.toISOString(),
        updatedAt: comicDoc.metadata.updatedAt.toISOString(),
        tags: [comicData.subject, comicData.gradeLevel, comicData.language],
        isPublic: false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "completed",
      createdAt: comicDoc.metadata.createdAt.toISOString(),
      updatedAt: comicDoc.metadata.updatedAt.toISOString()
    };
    
    return {
      success: true,
      message: "Comic saved successfully",
      id: result.insertedId.toString(),
      comic: serializedComic
    };
  } catch (error) {
    console.error("Save comic error:", error);
    throw new Error(error.message || "Failed to save comic");
  }
}

// DEPRECATED: Keep for backward compatibility but mark as deprecated
export async function uploadComicImagesToCloudinaryAndSave(comicData, userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("comics");

    // Upload all comic panel images to Cloudinary
    const uploadedImageUrls = [];
    const cloudinaryPublicIds = [];
    
    for (let i = 0; i < comicData.images.length; i++) {
      const imageData = comicData.images[i];
      
      // Handle data URLs - extract base64 if needed
      const base64Data = imageData.includes('data:') 
        ? imageData.split(',')[1]  // Extract base64 from data URL
        : imageData;               // Use as-is if already base64
      
      // Upload base64 image to Cloudinary
      const uploadResult = await uploadImageToCloudinary(base64Data, 'ai-comics');
      
      if (uploadResult.success) {
        uploadedImageUrls.push(uploadResult.url);
        cloudinaryPublicIds.push(uploadResult.publicId);
      } else {
        console.error(`Failed to upload panel ${i + 1}:`, uploadResult.error);
        // DON'T fallback to base64 - skip this panel or throw error
        throw new Error(`Failed to upload panel ${i + 1} to Cloudinary: ${uploadResult.error}`);
      }
    }

    // Create a title from the instruction (first 50 characters)
    const title = comicData.instructions 
      ? comicData.instructions.substring(0, 50) + (comicData.instructions.length > 50 ? '...' : '')
      : 'Untitled Comic';

    const comicDoc = {
      userId: new ObjectId(userId),
      title: title, // Add title field
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      comicType: comicData.comicType || "educational",
      imageUrls: uploadedImageUrls, // Cloudinary URLs
      cloudinaryPublicIds: cloudinaryPublicIds, // Store Cloudinary public IDs
      // REMOVED: images: comicData.images, // Don't store base64 images in database
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [comicData.subject, comicData.gradeLevel, comicData.language],
        isPublic: false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "completed"
    };

    const result = await collection.insertOne(comicDoc);
    
    // Properly serialize the comic object for client components
    const serializedComic = {
      _id: result.insertedId.toString(),
      userId: userId, // Keep as string since it's already a string parameter
      title: title, // Add title field
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      comicType: comicData.comicType || "educational",
      imageUrls: uploadedImageUrls,
      cloudinaryPublicIds: cloudinaryPublicIds,
      // REMOVED: images: comicData.images, // Don't store base64 images in database
      metadata: {
        createdAt: comicDoc.metadata.createdAt.toISOString(),
        updatedAt: comicDoc.metadata.updatedAt.toISOString(),
        tags: [comicData.subject, comicData.gradeLevel, comicData.language],
        isPublic: false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "completed",
      createdAt: comicDoc.metadata.createdAt.toISOString(),
      updatedAt: comicDoc.metadata.updatedAt.toISOString()
    };
    
    return {
      success: true,
      message: "Comic saved successfully",
      id: result.insertedId.toString(),
      comic: serializedComic
    };
  } catch (error) {
    console.error("Save comic error:", error);
    throw new Error(error.message || "Failed to save comic");
  }
}

export async function saveComic(comicData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const userId = session.user.id;

    // Convert comic data to the format expected by uploadComicImagesToCloudinaryAndSave
    const convertedData = {
      instructions: comicData.instruction || comicData.instructions,
      subject: comicData.subject || "General",
      gradeLevel: comicData.grade || comicData.gradeLevel,
      numPanels: comicData.numPanels || (comicData.panels ? comicData.panels.length : 0),
      language: comicData.language || "English",
      images: comicData.panels ? comicData.panels.map(panel => panel.imageBase64).filter(Boolean) : [], // Only include valid base64
      comicType: comicData.comicType || 'educational'
    };

    // Use the Cloudinary function
    const result = await uploadComicImagesToCloudinaryAndSave(convertedData, userId);
    
    return {
      success: result.success,
      comicId: result.id,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    console.error("Error saving comic:", error);
    return {
      success: false,
      error: error.message || "Failed to save comic"
    };
  }
}

export async function getComics() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    
    const userId = session.user.id;
    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");

    const comics = await comicsCollection
      .find({ userId: new ObjectId(userId) }) // Filter comics by the logged-in user's ID
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    // Convert ObjectIds to strings to make them serializable
    const serializedComics = comics.map(comic => ({
      ...comic,
      _id: comic._id.toString(),
      userId: comic.userId.toString(),
      // Ensure nested metadata dates are also serialized
      createdAt: comic.metadata?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: comic.metadata?.updatedAt?.toISOString() || new Date().toISOString()
    }));

    return {
      success: true,
      comics: serializedComics
    };
  } catch (error) {
    console.error("Error fetching comics:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch comics",
      comics: []
    };
  }
}

export async function updateComic(comicId, updateData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");
    
    const userId = session.user.id;

    // Check if comic exists and belongs to user
    const existingComic = await comicsCollection.findOne({
      _id: new ObjectId(comicId),
      userId: new ObjectId(userId)
    });

    if (!existingComic) {
      throw new Error("Comic not found or you don't have permission to update it");
    }

    const updateFields = {
      $set: {
        instruction: updateData.instructions || updateData.instruction,
        subject: updateData.subject,
        grade: updateData.gradeLevel,
        language: updateData.language,
        numPanels: updateData.numPanels,
        // REMOVED: images: updateData.images, // Don't store base64 images in database
        "metadata.updatedAt": new Date(),
        "metadata.tags": [updateData.subject, updateData.gradeLevel, updateData.language]
      }
    };

    await comicsCollection.updateOne(
      { _id: new ObjectId(comicId) },
      updateFields
    );

    return {
      success: true,
      message: "Comic updated successfully"
    };
  } catch (error) {
    console.error("Error updating comic:", error);
    return {
      success: false,
      message: error.message || "Failed to update comic"
    };
  }
}

export async function deleteComic(comicId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");
    
    const userId = session.user.id;

    // Check if comic exists and belongs to user
    const existingComic = await comicsCollection.findOne({
      _id: new ObjectId(comicId),
      userId: new ObjectId(userId)
    });

    if (!existingComic) {
      throw new Error("Comic not found or you don't have permission to delete it");
    }

    await comicsCollection.deleteOne({ _id: new ObjectId(comicId) });

    return {
      success: true,
      message: "Comic deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting comic:", error);
    return {
      success: false,
      message: error.message || "Failed to delete comic"
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
