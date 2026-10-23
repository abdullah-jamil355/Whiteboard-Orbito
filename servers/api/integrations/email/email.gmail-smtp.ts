import nodemailer from "nodemailer";
import type { EmailSender } from "./email.contracts.js";

type GmailSmtpEmailSenderDependencies = Readonly<{
  username: string;
  appPassword: string;
  timeoutMs?: number;
}>;

const gmailSmtpHost = "smtp.gmail.com";
const gmailSmtpPort = 587;
const requestTimeoutMs = 15_000;

export const createGmailSmtpEmailSender = ({ username, appPassword, timeoutMs = requestTimeoutMs }: GmailSmtpEmailSenderDependencies): EmailSender => {
  const transporter = nodemailer.createTransport({
    host: gmailSmtpHost,
    port: gmailSmtpPort,
    secure: false,
    requireTLS: true,
    auth: { user: username, pass: appPassword },
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs
  });

  return async (email) => {
    await transporter.sendMail({
      from: { name: "Whiteboard", address: username },
      to: email.recipient,
      subject: email.subject,
      html: email.html,
      text: email.text
    });
  };
};
