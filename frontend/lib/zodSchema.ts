import { z } from "zod";

export const teamMemberInviteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "teacher", "student"]),
  message: z.string().optional(),
});

export type TeamMemberInviteValues = z.infer<typeof teamMemberInviteSchema>;

