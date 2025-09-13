// Teacher conversation schema for Voice Coach chat history
export const TeacherConversationSchema = {
  _id: "ObjectId",
  teacherId: "ObjectId", // Reference to teacher
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
  teacherData: {
    grades: "Array", // Array of grades taught
    subjects: "Array", // Array of subjects taught
    teachingExperience: "String", // Teaching experience level
    preferences: "Object", // Teaching preferences and style
    analytics: "Object" // Teaching analytics and insights
  },
  studentContext: {
    students: "Array", // Array of student data relevant to conversation
    classPerformance: "Object", // Overall class performance data
    learningInsights: "Object" // Insights about student learning patterns
  },
  conversationStats: {
    totalMessages: "Number",
    userMessages: "Number",
    aiMessages: "Number",
    totalDuration: "Number", // Total conversation duration in minutes
    topicsDiscussed: "Array", // Extracted topics from conversation
    difficultyLevel: "String", // easy, medium, hard
    teachingOutcomes: "Array" // What the teacher learned or improved
  },
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    lastMessageAt: "Date",
    isActive: "Boolean", // Whether conversation is still active
    tags: "Array" // User-defined tags for organization
  }
};

export const TeacherConversationValidationSchema = {
  teacherId: { required: true, type: "ObjectId" },
  sessionId: { required: true, type: "string", maxLength: 100 },
  title: { required: true, type: "string", maxLength: 200 },
  sessionType: { 
    required: true, 
    type: "string", 
    enum: ["text", "voice", "mixed"] 
  },
  messages: { required: true, type: "array" },
  uploadedFiles: { required: false, type: "array" },
  teacherData: { required: true, type: "object" },
  studentContext: { required: false, type: "object" },
  conversationStats: { required: false, type: "object" }
};
