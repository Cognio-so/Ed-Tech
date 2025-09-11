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

export async function uploadComicImagesToCloudinaryAndSave(comicData, userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("comics");

    // Upload all comic panel images to Cloudinary
    const uploadedImageUrls = [];
    const cloudinaryPublicIds = [];
    
    for (let i = 0; i < comicData.images.length; i++) {
      const imageData = comicData.images[i];
      
      // Upload base64 image to Cloudinary
      const uploadResult = await uploadImageToCloudinary(imageData, 'ai-comics');
      
      if (uploadResult.success) {
        uploadedImageUrls.push(uploadResult.url);
        cloudinaryPublicIds.push(uploadResult.publicId);
      } else {
        console.error(`Failed to upload panel ${i + 1}:`, uploadResult.error);
        // Continue with other panels even if one fails
        uploadedImageUrls.push(imageData); // Fallback to base64
        cloudinaryPublicIds.push(null);
      }
    }

    const comicDoc = {
      userId: new ObjectId(userId),
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      comicType: comicData.comicType || "educational",
      imageUrls: uploadedImageUrls, // Cloudinary URLs
      cloudinaryPublicIds: cloudinaryPublicIds, // Store Cloudinary public IDs
      images: comicData.images, // Keep base64 images as backup
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
    
    return {
      success: true,
      message: "Comic saved successfully",
      id: result.insertedId.toString(),
      comic: {
        _id: result.insertedId.toString(),
        ...comicDoc,
        createdAt: comicDoc.metadata.createdAt,
        updatedAt: comicDoc.metadata.updatedAt
      }
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

    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");
    
    const userId = session.user.id;

    const comicDocument = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      instruction: comicData.instructions,
      subject: comicData.subject || "General",
      grade: comicData.gradeLevel,
      language: comicData.language || "English",
      numPanels: comicData.numPanels,
      images: comicData.images || [],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [comicData.subject, comicData.gradeLevel, comicData.language],
        isPublic: false,
        downloadCount: 0,
      }
    };

    await comicsCollection.insertOne(comicDocument);

    return {
      success: true,
      message: "Comic saved successfully",
      comicId: comicDocument._id.toString()
    };
  } catch (error) {
    console.error("Error saving comic:", error);
    return {
      success: false,
      message: error.message || "Failed to save comic"
    };
  }
}

export async function getComics() {
  try {
    const { db } = await connectToDatabase();
    const comicsCollection = db.collection("comics");
    
    const comics = await comicsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Convert ObjectIds to strings to make them serializable
    const serializedComics = comics.map(comic => ({
      ...comic,
      _id: comic._id.toString(),
      userId: comic.userId.toString(),
      createdAt: comic.createdAt.toISOString(),
      updatedAt: comic.updatedAt.toISOString()
    }));

    return {
      success: true,
      comics: serializedComics
    };
  } catch (error) {
    console.error("Error fetching comics:", error);
    throw new Error(error.message || "Failed to fetch comics");
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
        images: updateData.images,
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
