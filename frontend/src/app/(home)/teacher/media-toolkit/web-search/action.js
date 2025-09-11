"use server";

import PythonApiClient from "@/lib/PythonApi";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

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

export async function saveWebSearch(webSearchData, userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("webSearches");

    const webSearchDoc = {
      userId: new ObjectId(userId),
      title: webSearchData.metadata?.topic || "Web Search",
      topic: webSearchData.metadata?.topic || "",
      contentType: webSearchData.metadata?.contentType || "articles",
      subject: webSearchData.metadata?.subject || "",
      grade: webSearchData.metadata?.gradeLevel || "",
      language: webSearchData.metadata?.language || "English",
      searchQuery: webSearchData.searchQuery || "",
      searchResults: webSearchData.content || "",
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [webSearchData.metadata?.subject, webSearchData.metadata?.contentType],
        isPublic: false,
        downloadCount: 0,
        viewCount: 0
      },
      status: "draft"
    };

    const result = await collection.insertOne(webSearchDoc);
    
    return {
      success: true,
      message: "Web search saved successfully",
      id: result.insertedId.toString()
    };
  } catch (error) {
    console.error("Save web search error:", error);
    throw new Error(error.message || "Failed to save web search");
  }
}

export async function getWebSearches(userId) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("webSearches");

    const webSearches = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ "metadata.createdAt": -1 })
      .toArray();

    return {
      success: true,
      data: webSearches.map(search => ({
        id: search._id.toString(),
        title: search.title,
        topic: search.topic,
        subject: search.subject,
        contentType: search.contentType,
        grade: search.grade,
        language: search.language,
        searchQuery: search.searchQuery,
        content: search.searchResults,
        metadata: {
          topic: search.topic,
          subject: search.subject,
          contentType: search.contentType,
          gradeLevel: search.grade,
          language: search.language,
          comprehension: "intermediate"
        },
        createdAt: search.metadata.createdAt,
        updatedAt: search.metadata.updatedAt,
        downloadCount: search.metadata.downloadCount,
        viewCount: search.metadata.viewCount
      }))
    };
  } catch (error) {
    console.error("Get web searches error:", error);
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
