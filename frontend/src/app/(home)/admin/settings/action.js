"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// Get current admin profile
export async function getAdminProfile() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();
    
    // Get user from users collection
    const user = await db.collection('user').findOne({ 
      _id: new ObjectId(session.user.id) 
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Return user data without sensitive information
    const profileData = {
      _id: user._id.toString(),
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'admin',
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      profilePicture: user.profilePicture || '',
      preferences: user.preferences || {}
    };

    return {
      success: true,
      data: profileData
    };
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return { success: false, error: "Failed to fetch profile" };
  }
}

// Update admin profile
export async function updateAdminProfile(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const name = formData.get('name');
    const email = formData.get('email');

    if (!name || !email) {
      return { success: false, error: "Name and email are required" };
    }

    const { db } = await connectToDatabase();

    // Check if email is already taken by another user
    const existingUser = await db.collection('user').findOne({
      email: email,
      _id: { $ne: new ObjectId(session.user.id) }
    });

    if (existingUser) {
      return { success: false, error: "Email is already in use" };
    }

    // Update user profile
    const result = await db.collection('user').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          name: name,
          email: email,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "User not found" };
    }

    revalidatePath('/admin/settings');
    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    console.error('Error updating admin profile:', error);
    return { success: false, error: "Failed to update profile" };
  }
}

// Change password
export async function changePassword(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "All password fields are required" };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match" };
    }

    if (newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long" };
    }

    const { db } = await connectToDatabase();

    // Get current user
    const user = await db.collection('user').findOne({
      _id: new ObjectId(session.user.id)
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const result = await db.collection('user').updateOne(
      { _id: new ObjectId(session.user.id) },
      {
        $set: {
          password: hashedNewPassword,
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Failed to update password" };
    }

    return { success: true, message: "Password changed successfully" };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, error: "Failed to change password" };
  }
}

// Get admin dashboard statistics
export async function getAdminStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get user counts by role
    const userStats = await db.collection('user').aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Get total conversations
    const studentConversations = await db.collection('student_conversations').countDocuments();
    const teacherConversations = await db.collection('teacherConversations').countDocuments();

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStudentConversations = await db.collection('student_conversations').countDocuments({
      'metadata.createdAt': { $gte: sevenDaysAgo }
    });

    const recentTeacherConversations = await db.collection('teacherConversations').countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Format user stats
    const formattedUserStats = {
      admin: 0,
      teacher: 0,
      student: 0,
      total: 0
    };

    userStats.forEach(stat => {
      formattedUserStats[stat._id] = stat.count;
      formattedUserStats.total += stat.count;
    });

    const stats = {
      users: formattedUserStats,
      conversations: {
        total: studentConversations + teacherConversations,
        student: studentConversations,
        teacher: teacherConversations
      },
      recentActivity: {
        studentConversations: recentStudentConversations,
        teacherConversations: recentTeacherConversations,
        total: recentStudentConversations + recentTeacherConversations
      }
    };

    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}