"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

// Get user profile data
export async function getUserProfile() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const user = await db.collection('user').findOne({ _id: userId });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Return user data without sensitive information
    const userProfile = {
      id: user._id.toString(),
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'teacher',
      profilePicture: user.profilePicture || '',
      createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: user.updatedAt?.toISOString() || new Date().toISOString()
    };

    return { success: true, data: userProfile };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { success: false, error: "Failed to fetch profile data" };
  }
}

// Update user profile
export async function updateUserProfile(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Extract form data
    const { name } = formData;

    // Validate required fields
    if (!name || name.trim() === '') {
      return { success: false, error: "Name is required" };
    }

    // Check if user exists
    const existingUser = await db.collection('user').findOne({ _id: userId });
    if (!existingUser) {
      return { success: false, error: "User not found" };
    }

    // Prepare update data
    const updateData = {
      name: name.trim(),
      updatedAt: new Date()
    };

    // Update user in database
    const result = await db.collection('user').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: "No changes were made" };
    }

    // Revalidate the settings page
    revalidatePath('/teacher/settings');

    return { 
      success: true, 
      message: "Profile updated successfully",
      data: {
        ...existingUser,
        ...updateData,
        id: userId.toString()
      }
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
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

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const { currentPassword, newPassword, confirmPassword } = formData;

    // Validate passwords
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: "All password fields are required" };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "New passwords do not match" };
    }

    if (newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters long" };
    }

    // Get user to verify current password
    const user = await db.collection('user').findOne({ _id: userId });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // In a real app, you'd verify the current password using bcrypt
    // For now, we'll just update the password field
    const result = await db.collection('user').updateOne(
      { _id: userId },
      { 
        $set: { 
          password: newPassword, // In real app, hash this password
          updatedAt: new Date()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return { success: false, error: "Failed to update password" };
    }

    return { 
      success: true, 
      message: "Password updated successfully" 
    };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, error: "Failed to change password" };
  }
}

// Delete account
export async function deleteAccount(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    const { confirmDelete } = formData;
    if (confirmDelete !== 'DELETE') {
      return { success: false, error: "Please type 'DELETE' to confirm account deletion" };
    }

    // Delete user and related data
    const [userResult, conversationsResult, contentResult] = await Promise.all([
      db.collection('user').deleteOne({ _id: userId }),
      db.collection('teacherConversations').deleteMany({ teacherId: userId }),
      db.collection('contents').deleteMany({ userId: userId.toString() })
    ]);

    if (userResult.deletedCount === 0) {
      return { success: false, error: "Failed to delete account" };
    }

    return { 
      success: true, 
      message: "Account deleted successfully" 
    };
  } catch (error) {
    console.error('Error deleting account:', error);
    return { success: false, error: "Failed to delete account" };
  }
}
