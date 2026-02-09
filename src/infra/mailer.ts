import nodemailer, { Transporter } from "nodemailer";
import { getEnv } from "../config/env";
import { logger } from "../utils/logger";

let transporter: Transporter | null = null;

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getMailer(): Transporter {
  if (!transporter) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = getEnv();
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const { SMTP_FROM } = getEnv();
  const mailer = getMailer();

  try {
    await mailer.sendMail({ from: SMTP_FROM, to, subject, html });
    logger.info({ to, subject }, "Email sent successfully");
  } catch (error) {
    logger.error({ err: error, to, subject }, "Failed to send email");
    throw error;
  }
}

export function verificationEmailHtml(name: string, verifyUrl: string): string {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verifyUrl);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Verify Your Email Address</h2>
      <p>Hi ${safeName},</p>
      <p>Thank you for registering. Please click the button below to verify your email address:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Verify Email
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #6B7280;">${safeUrl}</p>
      <p>This link expires in 24 hours.</p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
      <p style="color: #9CA3AF; font-size: 12px;">If you did not create an account, please ignore this email.</p>
    </div>
  `;
}

export function passwordResetEmailHtml(
  name: string,
  resetUrl: string,
): string {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Your Password</h2>
      <p>Hi ${safeName},</p>
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${safeUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Reset Password
        </a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #6B7280;">${safeUrl}</p>
      <p>This link expires in 1 hour.</p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
      <p style="color: #9CA3AF; font-size: 12px;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
    </div>
  `;
}
