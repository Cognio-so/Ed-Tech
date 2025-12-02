"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

export async function getInvitationByToken(token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation not found",
      };
    }

    return {
      success: true,
      invitation,
    };
  } catch (error) {
    console.error("Error fetching invitation:", error);
    return {
      success: false,
      error: "Failed to fetch invitation",
    };
  }
}

export async function acceptInvitation(token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation not found",
      };
    }

    if (invitation.status !== "pending") {
      return {
        success: false,
        error: `Invitation has already been ${invitation.status}`,
      };
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      return {
        success: false,
        error: "Invitation has expired",
      };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "accepted" },
      });

      return {
        success: false,
        error: "User with this email already exists. Please log in instead.",
      };
    }

    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        emailVerified: false,
      },
    });

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });

    revalidatePath("/invitation");
    return {
      success: true,
      userId,
    };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Failed to accept invitation",
    };
  }
}

export async function rejectInvitation(token: string) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation not found",
      };
    }

    if (invitation.status !== "pending") {
      return {
        success: false,
        error: `Invitation has already been ${invitation.status}`,
      };
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "rejected" },
    });

    revalidatePath("/invitation");
    return {
      success: true,
    };
  } catch (error) {
    console.error("Error rejecting invitation:", error);
    return {
      success: false,
      error: "Failed to reject invitation",
    };
  }
}
