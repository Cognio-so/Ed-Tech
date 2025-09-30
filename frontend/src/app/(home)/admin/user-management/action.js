"use server";

import { connectToDatabase } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

// Fetch all users with pagination and search
export async function getUsers(page = 1, limit = 10, search = "", role = "") {
  try {
    const { db } = await connectToDatabase();
    
    // Better Auth uses "user" collection (singular), not "users"
    const usersCollection = db.collection("user");
    
    console.log("Fetching users from collection: user");
    
    // Build query
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    if (role) {
      query.role = role;
    }
    
    console.log("Query:", query);
    
    // Get total count
    const total = await usersCollection.countDocuments(query);
    console.log("Total users found:", total);
    
    // Get users with pagination
    const users = await usersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
    
    console.log("Raw users from DB:", users);
    
    return {
      users: users.map(user => ({
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email,
        role: user.role || "student",
        emailVerified: user.emailVerified || false,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
        image: user.image || null,
        grades: user.grades || [],
        subjects: user.subjects || []
      })),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    };
  } catch (error) {
    console.error("Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

// Get user by ID
export async function getUserById(userId) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return {
      id: user._id.toString(),
      name: user.name || "N/A",
      email: user.email,
      role: user.role || "student",
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || null,
      image: user.image || null,
      sessions: user.sessions || [],
      grades: user.grades || [],
      subjects: user.subjects || []
    };
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("Failed to fetch user");
  }
}

// Create new user
export async function createUser(formData) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");
    const role = formData.get("role");
    const gradesData = formData.get("grades");
    const subjectsData = formData.get("subjects");
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      throw new Error("All fields are required");
    }
    
    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }
    
    // Parse grades and subjects if provided
    let grades = [];
    let subjects = [];
    if (gradesData) {
      try {
        grades = JSON.parse(gradesData);
      } catch (e) {
        console.error("Error parsing grades:", e);
      }
    }
    if (subjectsData) {
      try {
        subjects = JSON.parse(subjectsData);
      } catch (e) {
        console.error("Error parsing subjects:", e);
      }
    }
    
    // Create user using better-auth
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
        role
      }
    });
    
    if (result.error) {
      throw new Error(result.error.message || "Failed to create user");
    }
    
    // Update user with grades and subjects if provided
    if (grades.length > 0 || subjects.length > 0) {
      await usersCollection.updateOne(
        { email },
        {
          $set: {
            grades: grades,
            subjects: subjects,
            updatedAt: new Date()
          }
        }
      );
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "User created successfully" };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, message: error.message || "Failed to create user" };
  }
}

// Update user
export async function updateUser(userId, formData) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const name = formData.get("name");
    const email = formData.get("email");
    const role = formData.get("role");
    const emailVerified = formData.get("emailVerified") === "true";
    const gradesData = formData.get("grades");
    const subjectsData = formData.get("subjects");
    
    // Validate required fields
    if (!name || !email || !role) {
      throw new Error("Name, email, and role are required");
    }
    
    // Check if email is already taken by another user
    const existingUser = await usersCollection.findOne({ 
      email, 
      _id: { $ne: new ObjectId(userId) } 
    });
    if (existingUser) {
      throw new Error("Email is already taken by another user");
    }
    
    // Parse grades and subjects if provided
    let grades = [];
    let subjects = [];
    if (gradesData) {
      try {
        grades = JSON.parse(gradesData);
      } catch (e) {
        console.error("Error parsing grades:", e);
      }
    }
    if (subjectsData) {
      try {
        subjects = JSON.parse(subjectsData);
      } catch (e) {
        console.error("Error parsing subjects:", e);
      }
    }
    
    // Update user
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          name,
          email,
          role,
          emailVerified,
          grades: grades,
          subjects: subjects,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "User updated successfully" };
  } catch (error) {
    console.error("Error updating user:", error);
    return { success: false, message: error.message || "Failed to update user" };
  }
}

// Delete user
export async function deleteUser(userId) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    // Check if user exists
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error("User not found");
    }
    
    // Prevent deleting the last admin
    if (user.role === "admin") {
      const adminCount = await usersCollection.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        throw new Error("Cannot delete the last admin user");
      }
    }
    
    // Delete user
    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
    
    if (result.deletedCount === 0) {
      throw new Error("Failed to delete user");
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { success: false, message: error.message || "Failed to delete user" };
  }
}

// Reset user password
export async function resetUserPassword(userId, newPassword) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    // Update password hash (in a real app, you'd hash the password)
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          password: newPassword, // In production, hash this password
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error("User not found");
    }
    
    return { success: true, message: "Password reset successfully" };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, message: error.message || "Failed to reset password" };
  }
}

// Get user statistics
export async function getUserStats() {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection("user");
    
    const stats = await usersCollection.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]).toArray();
    
    const totalUsers = await usersCollection.countDocuments();
    const verifiedUsers = await usersCollection.countDocuments({ emailVerified: true });
    
    return {
      totalUsers,
      verifiedUsers,
      unverifiedUsers: totalUsers - verifiedUsers,
      roleStats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    throw new Error("Failed to fetch user statistics");
  }
}

// Get all subjects and grades from curriculum collection
export async function getSubjectsAndGrades() {
  try {
    const { db } = await connectToDatabase();
    const curriculumCollection = db.collection("curriculum");
    
    // Fetch all curriculum documents
    const curriculumDocs = await curriculumCollection.find({}).toArray();
    
    // Extract unique subjects and grades from curriculum
    const subjectsSet = new Set();
    const gradesSet = new Set();
    
    curriculumDocs.forEach(doc => {
      if (doc.subject && doc.subject.trim()) {
        subjectsSet.add(doc.subject.trim());
      }
      if (doc.grade && doc.grade.trim()) {
        gradesSet.add(doc.grade.trim());
      }
    });
    
    // Convert sets to arrays and create objects with IDs
    const subjects = Array.from(subjectsSet).map((subject, index) => ({
      id: `subject_${index}`, // Generate a simple ID since we're extracting from curriculum
      name: subject,
      createdAt: new Date('2024-01-01') // Use a static date to avoid hydration mismatch
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    const grades = Array.from(gradesSet).map((grade, index) => ({
      id: `grade_${index}`, // Generate a simple ID since we're extracting from curriculum
      name: grade,
      createdAt: new Date('2024-01-01') // Use a static date to avoid hydration mismatch
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      success: true,
      subjects,
      grades
    };
  } catch (error) {
    console.error("Error fetching subjects and grades from curriculum:", error);
    return {
      success: false,
      subjects: [],
      grades: [],
      error: error.message || "Failed to fetch subjects and grades from curriculum"
    };
  }
}

// Create new subject (without description)
export async function createSubject(formData) {
  try {
    const { db } = await connectToDatabase();
    const subjectsCollection = db.collection("subjects");
    
    const name = formData.get("name");
    
    if (!name || !name.trim()) {
      throw new Error("Subject name is required");
    }
    
    // Check if subject already exists
    const existingSubject = await subjectsCollection.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existingSubject) {
      throw new Error("Subject with this name already exists");
    }
    
    const subjectDocument = {
      _id: new ObjectId(),
      name: name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await subjectsCollection.insertOne(subjectDocument);
    
    revalidatePath("/admin/user-management");
    return { 
      success: true, 
      message: "Subject created successfully",
      subjectId: subjectDocument._id.toString()
    };
  } catch (error) {
    console.error("Error creating subject:", error);
    return { 
      success: false, 
      message: error.message || "Failed to create subject" 
    };
  }
}

// Create new grade (using existing grade collection structure)
export async function createGrade(formData) {
  try {
    const { db } = await connectToDatabase();
    const gradesCollection = db.collection("grade"); // Use existing grade collection
    
    const gradeNumber = formData.get("grade_number");
    
    if (!gradeNumber || !gradeNumber.trim()) {
      throw new Error("Grade number is required");
    }
    
    // Check if grade already exists
    const existingGrade = await gradesCollection.findOne({ 
      grade_number: { $regex: new RegExp(`^${gradeNumber.trim()}$`, 'i') } 
    });
    
    if (existingGrade) {
      throw new Error("Grade with this number already exists");
    }
    
    const gradeDocument = {
      _id: new ObjectId(),
      grade_number: gradeNumber.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await gradesCollection.insertOne(gradeDocument);
    
    revalidatePath("/admin/user-management");
    return { 
      success: true, 
      message: "Grade created successfully",
      gradeId: gradeDocument._id.toString()
    };
  } catch (error) {
    console.error("Error creating grade:", error);
    return { 
      success: false, 
      message: error.message || "Failed to create grade" 
    };
  }
}

// Update grade
export async function updateGrade(gradeId, formData) {
  try {
    const { db } = await connectToDatabase();
    const gradesCollection = db.collection("grade");
    
    const gradeNumber = formData.get("grade_number");
    
    if (!gradeNumber || !gradeNumber.trim()) {
      throw new Error("Grade number is required");
    }
    
    // Check if grade already exists (excluding current grade)
    const existingGrade = await gradesCollection.findOne({ 
      grade_number: { $regex: new RegExp(`^${gradeNumber.trim()}$`, 'i') },
      _id: { $ne: new ObjectId(gradeId) }
    });
    
    if (existingGrade) {
      throw new Error("Grade with this number already exists");
    }
    
    const result = await gradesCollection.updateOne(
      { _id: new ObjectId(gradeId) },
      {
        $set: {
          grade_number: gradeNumber.trim(),
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      throw new Error("Grade not found");
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "Grade updated successfully" };
  } catch (error) {
    console.error("Error updating grade:", error);
    return { success: false, message: error.message || "Failed to update grade" };
  }
}

// Delete subject
export async function deleteSubject(subjectId) {
  try {
    const { db } = await connectToDatabase();
    const subjectsCollection = db.collection("subjects");
    const usersCollection = db.collection("user");
    
    // Check if any users are using this subject
    const usersWithSubject = await usersCollection.countDocuments({
      subjects: { $in: [subjectId] }
    });
    
    if (usersWithSubject > 0) {
      throw new Error("Cannot delete subject that is assigned to users");
    }
    
    const result = await subjectsCollection.deleteOne({ _id: new ObjectId(subjectId) });
    
    if (result.deletedCount === 0) {
      throw new Error("Subject not found");
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "Subject deleted successfully" };
  } catch (error) {
    console.error("Error deleting subject:", error);
    return { success: false, message: error.message || "Failed to delete subject" };
  }
}

// Delete grade
export async function deleteGrade(gradeId) {
  try {
    const { db } = await connectToDatabase();
    const gradesCollection = db.collection("grade"); // Use existing grade collection
    const usersCollection = db.collection("user");
    
    // Check if any users are using this grade
    const usersWithGrade = await usersCollection.countDocuments({
      grades: { $in: [gradeId] }
    });
    
    if (usersWithGrade > 0) {
      throw new Error("Cannot delete grade that is assigned to users");
    }
    
    const result = await gradesCollection.deleteOne({ _id: new ObjectId(gradeId) });
    
    if (result.deletedCount === 0) {
      throw new Error("Grade not found");
    }
    
    revalidatePath("/admin/user-management");
    return { success: true, message: "Grade deleted successfully" };
  } catch (error) {
    console.error("Error deleting grade:", error);
    return { success: false, message: error.message || "Failed to delete grade" };
  }
}
