// Video schema for MongoDB
export const VideoSchema = {
  _id: "ObjectId",
  userId: "ObjectId", 
  title: "String",
  topic: "String",
  voiceId: "String", 
  voiceName: "String", 
  talkingPhotoId: "String", 
  talkingPhotoName: "String", 
  presentationUrl: "String", 
  videoUrl: "String", 
  videoId: "String", 
  slidesCount: "Number",
  status: "String", 
  metadata: {
    createdAt: "Date",
    updatedAt: "Date",
    tags: ["String"],
    isPublic: "Boolean",
    downloadCount: "Number",
    viewCount: "Number"
  }
};

export const VideoValidationSchema = {
  title: { required: true, type: "string", maxLength: 200 },
  topic: { required: true, type: "string", maxLength: 500 },
  voiceId: { required: true, type: "string" },
  talkingPhotoId: { required: true, type: "string" },
  presentationUrl: { required: true, type: "string" }
};
