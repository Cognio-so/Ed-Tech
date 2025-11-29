import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, role, message, token } = body;

    if (!email || !name || !role || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Configure nodemailer for Gmail
    const gmailUsername = process.env.GMAIL_USERNAME || process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_PASSWORD;
    const senderName = process.env.MAIL_SENDER_NAME || process.env.GMAIL_SENDER_NAME || "Team";

    // Verify Gmail credentials
    if (!gmailUsername || !gmailPassword) {
      console.error("Gmail credentials not configured");
      return NextResponse.json(
        { error: "Gmail credentials not configured. Please set GMAIL_USERNAME and GMAIL_PASSWORD in your .env file" },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUsername,
        pass: gmailPassword,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/invitation/accept?token=${token}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">You're Invited!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;">
            <p style="font-size: 16px; margin-bottom: 20px;">Hello ${name},</p>
            <p style="font-size: 16px; margin-bottom: 20px;">
              You have been invited to join our team as a <strong>${role}</strong>.
            </p>
            ${message ? `<p style="font-size: 16px; margin-bottom: 20px; font-style: italic; color: #666;">"${message}"</p>` : ""}
            <p style="font-size: 16px; margin-bottom: 30px;">
              Click the button below to accept the invitation and set up your account:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Or copy and paste this link into your browser:
            </p>
            <p style="font-size: 12px; color: #999; word-break: break-all;">
              ${invitationLink}
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 30px;">
              This invitation will expire in 7 days.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Hello ${name},

You have been invited to join our team as a ${role}.

${message ? `Message: "${message}"` : ""}

Click the link below to accept the invitation and set up your account:
${invitationLink}

This invitation will expire in 7 days.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"${senderName}" <${gmailUsername}>`,
      to: email,
      subject: "You're Invited to Join Our Team",
      text: emailText,
      html: emailHtml,
    });

    console.log("Invitation email sent:", info.messageId);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return NextResponse.json(
      {
        error: "Failed to send invitation email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

