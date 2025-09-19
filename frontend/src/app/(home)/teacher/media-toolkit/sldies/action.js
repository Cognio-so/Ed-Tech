"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import PythonApiClient from "@/lib/PythonApi";
import { ObjectId } from "mongodb";

// Generate presentation using SlideSpeak API
export async function generatePresentation(presentationData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    // Transform frontend data to match Python backend schema
    const pythonSchema = {
      plain_text: presentationData.topic,                    // ✅ Fixed: was 'topic'
      custom_user_instructions: presentationData.instructions || '',  // ✅ Fixed: was 'instructions'
      length: parseInt(presentationData.slideCount),         // ✅ Fixed: was 'slideCount'
      language: presentationData.language,                   // ✅ Remove conversion, let PythonApi.js handle it
      fetch_images: presentationData.includeImages !== false,  // ✅ Fixed: was 'includeImages'
      verbosity: presentationData.verbosity || 'standard',
      template: presentationData.template || 'default'
    };

    console.log('Sending presentation request:', pythonSchema);
    const result = await PythonApiClient.generatePresentation(pythonSchema);

    if (result.presentation) {
      return {
        success: true,
        presentation: result.presentation,
        message: "Presentation generated successfully"
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to generate presentation"
      };
    }
  } catch (error) {
    console.error("Error generating presentation:", error);
    return {
      success: false,
      error: error.message || "Failed to generate presentation"
    };
  }
}

// Save presentation to database
export async function savePresentationToDatabase(presentationData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const presentationDocument = {
      userId: session.user.id,
      title: presentationData.title,
      topic: presentationData.topic,
      slideCount: presentationData.slideCount,
      template: presentationData.template,
      language: presentationData.language,
      verbosity: presentationData.verbosity,
      includeImages: presentationData.includeImages,
      instructions: presentationData.instructions,
      presentationUrl: presentationData.presentationUrl,
      downloadUrl: presentationData.downloadUrl,
      taskId: presentationData.taskId,
      taskStatus: presentationData.taskStatus,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: presentationData.tags || [],
        isPublic: presentationData.isPublic || false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "saved"
    };

    const result = await presentationsCollection.insertOne(presentationDocument);

    return {
      success: true,
      presentationId: result.insertedId.toString(),
      message: "Presentation saved to database successfully"
    };
  } catch (error) {
    console.error("Error saving presentation:", error);
    return {
      success: false,
      error: error.message || "Failed to save presentation to database"
    };
  }
}

// Get user presentations
export async function getUserPresentations(userId = null) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const query = userId ? { userId: userId } : { userId: session.user.id };
    const presentations = await presentationsCollection
      .find(query)
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    // Convert ObjectId to string for serialization
    const serializedPresentations = presentations.map(presentation => ({
      ...presentation,
      _id: presentation._id.toString(),
      userId: presentation.userId.toString()
    }));

    return {
      success: true,
      presentations: serializedPresentations
    };
  } catch (error) {
    console.error("Error fetching presentations:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch presentations"
    };
  }
}

// Delete presentation from database
export async function deletePresentationFromDatabase(presentationId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const presentationsCollection = db.collection("presentations");

    const result = await presentationsCollection.deleteOne({
      _id: new ObjectId(presentationId),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Presentation not found or you don't have permission to delete it"
      };
    }

    return {
      success: true,
      message: "Presentation deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting presentation:", error);
    return {
      success: false,
      error: error.message || "Failed to delete presentation"
    };
  }
}
