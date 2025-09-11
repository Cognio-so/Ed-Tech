"use server";

import { connectToDatabase } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";

// Helper function to safely create ObjectId
function safeObjectId(id) {
  try {
    // Check if it's already a valid ObjectId format (24 hex chars)
    if (ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    // If not, treat it as a string and search by _id as string
    return id;
  } catch (error) {
    // If ObjectId creation fails, return the original string
    return id;
  }
}

// Fetch all curriculum with pagination and search
export async function getCurriculum(page = 1, limit = 10, search = "", grade = "", subject = "") {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { curriculum_name: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
        { grade: { $regex: search, $options: "i" } }
      ];
    }
    if (grade) {
      query.grade = grade;
    }
    if (subject) {
      query.subject = { $regex: subject, $options: "i" };
    }
    
    // Get total count
    const total = await curriculumCollection.countDocuments(query);
    
    // Get curriculum with pagination
    const curriculum = await curriculumCollection
      .find(query)
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    return {
      curriculum: curriculum.map(item => ({
        id: item._id.toString(),
        curriculum_name: item.curriculum_name || "N/A",
        subject: item.subject || "N/A",
        grade: item.grade || "N/A",
        ocrfile_id: item.ocrfile_id || "",
        url: item.url || "",
        file_id: item.file_id || "",
        createdAt: item.createdAt || new Date(),
        updatedAt: item.updatedAt || new Date()
      })),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error("Error fetching curriculum:", error);
    throw new Error("Failed to fetch curriculum");
  }
}

// Get curriculum by ID
export async function getCurriculumById(curriculumId) {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    // Try to find by ObjectId first, then by string _id
    let curriculum = null;
    
    if (ObjectId.isValid(curriculumId)) {
      curriculum = await curriculumCollection.findOne({ _id: new ObjectId(curriculumId) });
    }
    
    // If not found with ObjectId, try searching by string _id
    if (!curriculum) {
      curriculum = await curriculumCollection.findOne({ _id: curriculumId });
    }
    
    if (!curriculum) {
      throw new Error("Curriculum not found");
    }
    
    return {
      id: curriculum._id.toString(),
      curriculum_name: curriculum.curriculum_name || "N/A",
      subject: curriculum.subject || "N/A",
      grade: curriculum.grade || "N/A",
      ocrfile_id: curriculum.ocrfile_id || "",
      url: curriculum.url || "",
      file_id: curriculum.file_id || "",
      createdAt: curriculum.createdAt || new Date(),
      updatedAt: curriculum.updatedAt || new Date()
    };
  } catch (error) {
    console.error("Error fetching curriculum:", error);
    throw new Error("Failed to fetch curriculum");
  }
}

// Create new curriculum
export async function createCurriculum(formData) {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    const curriculum_name = formData.get("curriculum_name");
    const subject = formData.get("subject");
    const grade = formData.get("grade");
    const ocrfile_id = formData.get("ocrfile_id");
    const url = formData.get("url");
    const file_id = formData.get("file_id");
    
    // Validate required fields
    if (!curriculum_name || !subject || !grade) {
      throw new Error("Curriculum name, subject, and grade are required");
    }
    
    // Check if curriculum already exists
    const existingCurriculum = await curriculumCollection.findOne({ 
      curriculum_name,
      subject,
      grade
    });
    if (existingCurriculum) {
      throw new Error("Curriculum with this name, subject, and grade already exists");
    }
    
    // Create curriculum
    const result = await curriculumCollection.insertOne({
      curriculum_name,
      subject,
      grade,
      ocrfile_id: ocrfile_id || "",
      url: url || "",
      file_id: file_id || "",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    if (!result.insertedId) {
      throw new Error("Failed to create curriculum");
    }
    
    revalidatePath("/admin/curriculum-management");
    return { success: true, message: "Curriculum created successfully" };
  } catch (error) {
    console.error("Error creating curriculum:", error);
    return { success: false, message: error.message || "Failed to create curriculum" };
  }
}

// Update curriculum
export async function updateCurriculum(curriculumId, formData) {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    const curriculum_name = formData.get("curriculum_name");
    const subject = formData.get("subject");
    const grade = formData.get("grade");
    const ocrfile_id = formData.get("ocrfile_id");
    const url = formData.get("url");
    const file_id = formData.get("file_id");
    
    // Validate required fields
    if (!curriculum_name || !subject || !grade) {
      throw new Error("Curriculum name, subject, and grade are required");
    }
    
    // Build query for existing curriculum check
    let existingQuery = { 
      curriculum_name,
      subject,
      grade
    };
    
    // Add exclusion for current curriculum
    if (ObjectId.isValid(curriculumId)) {
      existingQuery._id = { $ne: new ObjectId(curriculumId) };
    } else {
      existingQuery._id = { $ne: curriculumId };
    }
    
    // Check if curriculum already exists (excluding current one)
    const existingCurriculum = await curriculumCollection.findOne(existingQuery);
    if (existingCurriculum) {
      throw new Error("Curriculum with this name, subject, and grade already exists");
    }
    
    // Build update query
    let updateQuery;
    if (ObjectId.isValid(curriculumId)) {
      updateQuery = { _id: new ObjectId(curriculumId) };
    } else {
      updateQuery = { _id: curriculumId };
    }
    
    // Update curriculum
    const result = await curriculumCollection.updateOne(
      updateQuery,
      {
        $set: {
          curriculum_name,
          subject,
          grade,
          ocrfile_id: ocrfile_id || "",
          url: url || "",
          file_id: file_id || "",
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error("Curriculum not found");
    }
    
    revalidatePath("/admin/curriculum-management");
    return { success: true, message: "Curriculum updated successfully" };
  } catch (error) {
    console.error("Error updating curriculum:", error);
    return { success: false, message: error.message || "Failed to update curriculum" };
  }
}

// Delete curriculum
export async function deleteCurriculum(curriculumId) {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    // Build query for finding curriculum
    let findQuery;
    if (ObjectId.isValid(curriculumId)) {
      findQuery = { _id: new ObjectId(curriculumId) };
    } else {
      findQuery = { _id: curriculumId };
    }
    
    // Check if curriculum exists
    const curriculum = await curriculumCollection.findOne(findQuery);
    if (!curriculum) {
      throw new Error("Curriculum not found");
    }
    
    // Delete curriculum
    const result = await curriculumCollection.deleteOne(findQuery);
    
    if (result.deletedCount === 0) {
      throw new Error("Failed to delete curriculum");
    }
    
    revalidatePath("/admin/curriculum-management");
    return { success: true, message: "Curriculum deleted successfully" };
  } catch (error) {
    console.error("Error deleting curriculum:", error);
    return { success: false, message: error.message || "Failed to delete curriculum" };
  }
}

// Get curriculum statistics
export async function getCurriculumStats() {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    const stats = await curriculumCollection.aggregate([
      {
        $group: {
          _id: "$grade",
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const subjectStats = await curriculumCollection.aggregate([
      {
        $group: {
          _id: "$subject",
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const totalCurriculum = await curriculumCollection.countDocuments();
    
    return {
      totalCurriculum,
      gradeStats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      subjectStats: subjectStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error("Error fetching curriculum stats:", error);
    throw new Error("Failed to fetch curriculum statistics");
  }
}

// Get unique grades for filter
export async function getUniqueGrades() {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    const grades = await curriculumCollection.distinct("grade");
    return grades.sort();
  } catch (error) {
    console.error("Error fetching grades:", error);
    return [];
  }
}

// Get unique subjects for filter
export async function getUniqueSubjects() {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    const subjects = await curriculumCollection.distinct("subject");
    return subjects.sort();
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return [];
  }
}
