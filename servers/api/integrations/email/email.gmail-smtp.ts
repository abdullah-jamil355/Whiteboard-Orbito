import nodemailer from "nodemailer";
import type { EmailSender } from "./email.contracts.js";

type GmailSmtpEmailSenderDependencies = Readonly<{
  username: string;
  appPassword: string;
  timeoutMs?: number;
}>;

const requestTimeoutMs = 15_000;

export const createGmailSmtpEmailSender = ({ username, appPassword, timeoutMs = requestTimeoutMs }: GmailSmtpEmailSenderDependencies): EmailSender => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: username, pass: appPassword },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs
  });

  return async (email) => {
    try {
      const info = await transporter.sendMail({
        from: { name: "Orbito Whiteboard", address: username },
        to: email.recipient,
        subject: email.subject,
        html: email.html,
        text: email.text
      });
      console.log(`[EMAIL SUCCESS] Sent to ${email.recipient}, messageId: ${info.messageId}`);
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${email.recipient}:`, error);
      throw error;
    }
  };
};
