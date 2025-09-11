// Web Search schema for MongoDB
export const WebSearchSchema = {
    _id: "ObjectId",
    userId: "ObjectId", // Reference to user who created the search
    title: "String",
    topic: "String",
    contentType: "String", // articles, videos, images, documents
    subject: "String",
    grade: "String",
    language: "String", // English, Arabic
    searchQuery: "String", // The generated search query
    searchResults: [{
      title: "String",
      url: "String",
      snippet: "String",
      source: "String",
      relevanceScore: "Number",
      contentType: "String"
    }],
    metadata: {
      createdAt: "Date",
      updatedAt: "Date",
      tags: ["String"],
      isPublic: "Boolean",
      downloadCount: "Number",
      viewCount: "Number"
    },
    status: "String" // draft, published, archived
  };
  
  // Validation schema for web search creation
  export const WebSearchValidationSchema = {
    title: { required: true, type: "string", maxLength: 200 },
    topic: { required: true, type: "string", maxLength: 500 },
    contentType: { required: true, type: "string", enum: ["articles", "videos", "images", "documents"] },
    subject: { required: true, type: "string" },
    grade: { required: true, type: "string" },
    language: { required: true, type: "string", enum: ["English", "Arabic"] },
    searchQuery: { required: true, type: "string" },
    searchResults: { required: true, type: "array", minLength: 1 }
  };