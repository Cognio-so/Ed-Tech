// Student conversation schema for AI Tutor chat history
export const StudentConversationSchema = {
  _id: "ObjectId",
  studentId: "ObjectId", // Reference to student
  sessionId: "String", // Unique session identifier
  title: "String", // Conversation title (auto-generated or user-defined)
  sessionType: "String", // text, voice, mixed
  messages: [
    {
      id: "String", // Unique message ID
      role: "String", // user, assistant
      content: "String", // Message content
      timestamp: "Date", // When message was sent
      isImageResponse: "Boolean", // Whether this is an image response
      metadata: {
        messageType: "String", // text, image, file_upload, error
        fileAttachments: "Array", // Array of file names if any
        processingTime: "Number" // Time taken to process (for AI messages)
      }
    }
  ],
  uploadedFiles: [
    {
      filename: "String", // Original filename
      originalName: "String", // Display name
      fileType: "String", // File MIME type
      uploadTime: "Date"
    }
  ],
  studentData: {
    grade: "String",
    subjects: "Array", // Array of subjects
    progress: "Object", // Student progress data at time of conversation
    achievements: "Array", // Student achievements at time of conversation
    learningStats: "Object" // Learning statistics at time of conversation
  },
  conversationStats: {
    totalMessages: "Number",
    userMessages: "Number",
    aiMessages: "Number",
    totalDuration: "Number", // Total conversation duration in minutes
    topicsDiscussed: "Array", // Extracted topics from conversation
    difficultyLevel: "String", // easy, medium, hard
    learningOutcomes: "Array" // What the student learned
  },
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    lastMessageAt: "Date",
    isActive: "Boolean", // Whether conversation is still active
    tags: "Array" // User-defined tags for organization
  }
};

export const StudentConversationValidationSchema = {
  studentId: { required: true, type: "ObjectId" },
  sessionId: { required: true, type: "string", maxLength: 100 },
  title: { required: true, type: "string", maxLength: 200 },
  sessionType: { 
    required: true, 
    type: "string", 
    enum: ["text", "voice", "mixed"] 
  },
  messages: { required: true, type: "array" },
  uploadedFiles: { required: false, type: "array" },
  studentData: { required: true, type: "object" },
  conversationStats: { required: false, type: "object" }
};
