"use server";

import PythonApiClient from "@/lib/PythonApi";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
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

// Function to save comic with pre-uploaded Cloudinary URLs (no base64 processing)
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

    // Validate that we have image URLs
    if (!comicData.imageUrls || comicData.imageUrls.length === 0) {
      throw new Error("No image URLs provided for saving");
    }

    const comicDoc = {
      userId: new ObjectId(session.user.id),
      title: title,
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels || comicData.imageUrls.length,
      comicType: comicData.comicType || "educational",
      imageUrls: comicData.imageUrls, // Cloudinary URLs only
      cloudinaryPublicIds: comicData.cloudinaryPublicIds || [], // Cloudinary public IDs
      panelTexts: comicData.panelTexts || [], // Store panel texts separately
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
      numPanels: comicData.numPanels || comicData.imageUrls.length,
      comicType: comicData.comicType || "educational",
      imageUrls: comicData.imageUrls,
      cloudinaryPublicIds: comicData.cloudinaryPublicIds || [],
      panelTexts: comicData.panelTexts || [],
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

export async function getComics(page = 1, limit = 20) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    
    const userId = session.user.id;
    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Use limit and skip to avoid memory issues
    const comics = await comicsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ "metadata.createdAt": -1 })
      .limit(limit)
      .skip(skip)
      .toArray();

    // Get total count for pagination info
    const totalCount = await comicsCollection.countDocuments({ userId: new ObjectId(userId) });

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
      comics: serializedComics,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    };
  } catch (error) {
    console.error("Error fetching comics:", error);
    return {
      success: false,
      message: error.message || "Failed to fetch comics",
      comics: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      }
    };
  }
}

// Alternative: Get recent comics only (last 50)
export async function getRecentComics() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    
    const userId = session.user.id;
    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");

    // Get only the most recent 50 comics to avoid memory issues
    const comics = await comicsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ "metadata.createdAt": -1 })
      .limit(50)
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
    console.error("Error fetching recent comics:", error);
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
