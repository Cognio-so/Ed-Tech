"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Fetch all content types for the library
export async function getAllLibraryContent() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    // Fetch all content types in parallel for better performance
    const [
      contentsResult,
      presentationsResult,
      comicsResult,
      imagesResult,
      videosResult,
      assessmentsResult,
      webSearchesResult
    ] = await Promise.allSettled([
      // Content (lessons, presentations, worksheets)
      db.collection("contents")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Presentations/Slides
      db.collection("presentations")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Comics - Fixed: Now filtering by userId
      db.collection("comics")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Images
      db.collection("images")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Videos
      db.collection("videos")
        .find({ userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Assessments
      db.collection("assessments")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray(),
      
      // Web Searches
      db.collection("webSearches")
        .find({ userId: new ObjectId(userId) })
        .sort({ "metadata.createdAt": -1 })
        .limit(50)
        .toArray()
    ]);

    // Process results and handle errors gracefully
    const processResult = (result, type) => {
      if (result.status === 'fulfilled') {
        return result.value.map(item => ({
          ...item,
          _id: item._id.toString(),
          userId: item.userId.toString(),
          type,
          createdAt: item.metadata?.createdAt || item.createdAt,
          updatedAt: item.metadata?.updatedAt || item.updatedAt
        }));
      } else {
        console.error(`Error fetching ${type}:`, result.reason);
        return [];
      }
    };

    const contents = processResult(contentsResult, 'content');
    const presentations = processResult(presentationsResult, 'slides');
    const comics = processResult(comicsResult, 'comic');
    const images = processResult(imagesResult, 'image');
    const videos = processResult(videosResult, 'video');
    const assessments = processResult(assessmentsResult, 'assessment');
    const webSearches = processResult(webSearchesResult, 'websearch');

    // Combine all content and sort by creation date
    const allContent = [
      ...contents,
      ...presentations,
      ...comics,
      ...images,
      ...videos,
      ...assessments,
      ...webSearches
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get counts for each type
    const counts = {
      all: allContent.length,
      content: contents.length,
      slides: presentations.length,
      comic: comics.length,
      image: images.length,
      video: videos.length,
      assessment: assessments.length,
      websearch: webSearches.length
    };

    return {
      success: true,
      content: allContent,
      counts,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error("Error fetching library content:", error);
    return {
      success: false,
      error: error.message || "Failed to fetch library content",
      content: [],
      counts: {
        all: 0,
        content: 0,
        slides: 0,
        comic: 0,
        image: 0,
        video: 0,
        assessment: 0,
        websearch: 0
      }
    };
  }
}

// Delete content by type and ID
export async function deleteLibraryContent(contentId, contentType) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const userId = session.user.id;

    let collectionName;
    let query;

    switch (contentType) {
      case 'content':
        collectionName = 'contents';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'slides':
        collectionName = 'presentations';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'comic':
        collectionName = 'comics';
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      case 'image':
        collectionName = 'images';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'video':
        collectionName = 'videos';
        query = { _id: new ObjectId(contentId), userId };
        break;
      case 'assessment':
        collectionName = 'assessments';
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      case 'websearch':
        collectionName = 'webSearches';
        query = { _id: new ObjectId(contentId), userId: new ObjectId(userId) };
        break;
      default:
        throw new Error("Invalid content type");
    }

    const result = await db.collection(collectionName).deleteOne(query);

    if (result.deletedCount === 0) {
      throw new Error("Content not found or access denied");
    }

    return {
      success: true,
      message: "Content deleted successfully"
    };

  } catch (error) {
    console.error("Error deleting content:", error);
    return {
      success: false,
      error: error.message || "Failed to delete content"
    };
  }
}
