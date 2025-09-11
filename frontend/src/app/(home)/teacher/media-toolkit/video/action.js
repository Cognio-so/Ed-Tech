"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import PythonApiClient from "@/lib/PythonApi";
import { ObjectId } from "mongodb";

export async function generateVideoFromPPTX(videoData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    console.log('Starting video generation request:', videoData);
    const result = await PythonApiClient.generateVideoPresentation(videoData);

    if (result.success) {
      return {
        success: true,
        video: result,
        message: "Video generation completed successfully"
      };
    } else {
      return {
        success: false,
        error: result.error || "Failed to generate video"
      };
    }
  } catch (error) {
    console.error("Error generating video:", error);
    return {
      success: false,
      error: error.message || "Failed to generate video"
    };
  }
}

// NEW: Check video generation status
export async function checkVideoGenerationStatus(taskId) {
  try {
    const result = await PythonApiClient.checkVideoStatus(taskId);
    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error("Error checking video status:", error);
    return {
      success: false,
      error: error.message || "Failed to check video status"
    };
  }
}

export async function saveVideoToDatabase(videoData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const videosCollection = db.collection("videos");

    const videoDocument = {
      userId: session.user.id,
      title: videoData.title,
      topic: videoData.topic,
      voiceId: videoData.voiceId,
      voiceName: videoData.voiceName,
      talkingPhotoId: videoData.talkingPhotoId,
      talkingPhotoName: videoData.talkingPhotoName,
      presentationUrl: videoData.presentationUrl,
      videoUrl: videoData.videoUrl,
      videoId: videoData.videoId,
      slidesCount: videoData.slidesCount,
      status: videoData.status || "pending",
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: videoData.tags || [],
        isPublic: videoData.isPublic || false,
        downloadCount: 0,
        viewCount: 0
      }
    };

    const result = await videosCollection.insertOne(videoDocument);

    return {
      success: true,
      videoId: result.insertedId.toString(),
      message: "Video saved to database successfully"
    };
  } catch (error) {
    console.error("Error saving video:", error);
    return {
      success: false,
      error: error.message || "Failed to save video to database"
    };
  }
}

export async function getUserVideos(userId = null) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const videosCollection = db.collection("videos");

    const query = userId ? { userId: userId } : { userId: session.user.id };
    const videos = await videosCollection
      .find(query)
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    const serializedVideos = videos.map(video => ({
      ...video,
      _id: video._id.toString(),
      userId: video.userId.toString()
    }));

    return {
      success: true,
      videos: serializedVideos
    };
  } catch (error) {
    console.error("Error fetching videos:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch videos"
    };
  }
}

export async function deleteVideoFromDatabase(videoId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const videosCollection = db.collection("videos");

    const result = await videosCollection.deleteOne({
      _id: new ObjectId(videoId),
      userId: session.user.id
    });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Video not found or you don't have permission to delete it"
      };
    }

    return {
      success: true,
      message: "Video deleted successfully"
    };
  } catch (error) {
    console.error("Error deleting video:", error);
    return {
      success: false,
      error: error.message || "Failed to delete video"
    };
  }
}
