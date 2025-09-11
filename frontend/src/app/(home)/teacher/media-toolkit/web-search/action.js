"use server";

import PythonApiClient from "@/lib/PythonApi";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { getServerSession } from "@/lib/get-session";

export async function searchWeb(formData) {
  try {
    console.log("Web search request:", formData);
    
    const result = await PythonApiClient.runWebSearch({
      topic: formData.topic,
      subject: formData.subject,
      contentType: formData.contentType,
      gradeLevel: formData.gradeLevel,
      language: formData.language,
      comprehension: formData.comprehension,
      maxResults: 5 
    });

    console.log("Web search result:", result);

    // Transform the result for content preview
    const transformedResult = {
      searchQuery: result.query,
      content: result.content,
      metadata: {
        topic: formData.topic,
        subject: formData.subject,
        contentType: formData.contentType,
        gradeLevel: formData.gradeLevel,
        language: formData.language,
        comprehension: formData.comprehension
      }
    };

    return transformedResult;
  } catch (error) {
    console.error("Web search error:", error);
    throw new Error(error.message || "Failed to perform web search");
  }
}

export async function saveWebSearch(webSearchData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const webSearchesCollection = db.collection("websearches");
    
    const userId = session.user.id;

    const searchDocument = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      title: webSearchData.title || "Web Search",
      topic: webSearchData.metadata?.topic || "",
      contentType: webSearchData.metadata?.contentType || "articles",
      subject: webSearchData.metadata?.subject || "",
      grade: webSearchData.metadata?.gradeLevel || "",
      language: webSearchData.metadata?.language || "English",
      searchQuery: webSearchData.searchQuery || "",
      content: webSearchData.content || "",
      metadata: {
        topic: webSearchData.metadata?.topic || "",
        subject: webSearchData.metadata?.subject || "",
        contentType: webSearchData.metadata?.contentType || "articles",
        gradeLevel: webSearchData.metadata?.gradeLevel || "",
        language: webSearchData.metadata?.language || "English",
        comprehension: webSearchData.metadata?.comprehension || "intermediate",
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [webSearchData.metadata?.subject, webSearchData.metadata?.contentType],
        isPublic: false,
        downloadCount: 0,
      }
    };

    await webSearchesCollection.insertOne(searchDocument);

    return {
      success: true,
      message: "Web search saved successfully",
      searchId: searchDocument._id.toString()
    };
  } catch (error) {
    console.error("Error saving web search:", error);
    return {
      success: false,
      message: error.message || "Failed to save web search"
    };
  }
}

export async function getWebSearches() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    const { db } = await connectToDatabase();
    const webSearchesCollection = db.collection("websearches");
    
    const searches = await webSearchesCollection
      .find({ userId: new ObjectId(session.user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    // Convert ObjectIds to strings to make them serializable
    const serializedSearches = searches.map(search => ({
      ...search,
      _id: search._id.toString(),
      userId: search.userId.toString(),
      createdAt: search.createdAt.toISOString(),
      updatedAt: search.updatedAt.toISOString()
    }));

    return {
      success: true,
      data: serializedSearches
    };
  } catch (error) {
    console.error("Error fetching web searches:", error);
    throw new Error(error.message || "Failed to fetch web searches");
  }
}

export async function updateWebSearch(id, updateData, userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("webSearches");

    const updateDoc = {
      $set: {
        title: updateData.title || updateData.metadata?.topic,
        topic: updateData.metadata?.topic,
        contentType: updateData.metadata?.contentType,
        subject: updateData.metadata?.subject,
        grade: updateData.metadata?.gradeLevel,
        language: updateData.metadata?.language,
        searchQuery: updateData.searchQuery,
        searchResults: updateData.content,
        "metadata.updatedAt": new Date(),
        "metadata.tags": [updateData.metadata?.subject, updateData.metadata?.contentType]
      }
    };

    const result = await collection.updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(userId) },
      updateDoc
    );

    if (result.matchedCount === 0) {
      throw new Error("Web search not found or access denied");
    }

    return {
      success: true,
      message: "Web search updated successfully"
    };
  } catch (error) {
    console.error("Update web search error:", error);
    throw new Error(error.message || "Failed to update web search");
  }
}

export async function deleteWebSearch(id, userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("webSearches");

    const result = await collection.deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      throw new Error("Web search not found or access denied");
    }

    return {
      success: true,
      message: "Web search deleted successfully"
    };
  } catch (error) {
    console.error("Delete web search error:", error);
    throw new Error(error.message || "Failed to delete web search");
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
