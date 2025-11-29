"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { teamMemberInviteSchema } from "@/lib/zodSchema";
import { randomBytes } from "crypto";

export async function createInvitation(data: {
  name: string;
  email: string;
  role: string;
  message?: string;
}) {
  try {
    // Validate the data
    const validatedData = teamMemberInviteSchema.parse(data);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Check if there's a pending invitation for this email
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: validatedData.email,
        status: "pending",
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return {
        success: false,
        error: "An invitation has already been sent to this email",
      };
    }

    // Generate a secure token
    const token = randomBytes(32).toString("hex");

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create the invitation
    const invitation = await prisma.invitation.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        role: validatedData.role,
        message: validatedData.message || null,
        token,
        expiresAt,
        status: "pending",
      },
    });

    // Send email via API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/invitations/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invitationId: invitation.id,
        email: validatedData.email,
        name: validatedData.name,
        role: validatedData.role,
        message: validatedData.message,
        token,
      }),
    });

    if (!response.ok) {
      // Delete the invitation if email sending fails
      await prisma.invitation.delete({
        where: { id: invitation.id },
      });
      return {
        success: false,
        error: "Failed to send invitation email",
      };
    }

    revalidatePath("/admin");
    return {
      success: true,
      invitation,
    };
  } catch (error) {
    console.error("Error creating invitation:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Failed to create invitation",
    };
  }
}

