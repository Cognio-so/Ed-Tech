import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { connectToDatabase } from "@/lib/db";
import { sendVerificationEmail } from "./email.js";

// Initialize database connection
let db;
try {
  const { db: database } = await connectToDatabase();
  db = database;
} catch (error) {
  console.error("Failed to initialize database:", error);
  throw error;
}

export const auth = betterAuth({
  database: mongodbAdapter(db),
  emailAndPassword: { 
    enabled: true
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      try {
        await sendVerificationEmail(user.email, url);
        console.log(`Verification email sent to ${user.email}`);
      } catch (error) {
        console.error("Failed to send verification email:", error);
        throw error;
      }
    }
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "student", 
        validate: (value) => {
          const allowedRoles = ["student", "teacher", "admin"];
          return allowedRoles.includes(value);
        }
      }
    }
  }
});

// export type Session = typeof auth.$Infer.Session;
// export type User = typeof auth.$Infer.Session.User;