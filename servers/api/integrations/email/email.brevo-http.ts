import type { EmailSender, OutgoingEmail } from "./email.contracts.js";

type BrevoHttpEmailSenderDependencies = Readonly<{
  apiKey: string;
  senderEmail: string;
  senderName?: string;
  timeoutMs?: number;
}>;

const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";
const requestTimeoutMs = 15_000;

export const createBrevoHttpEmailSender = ({
  apiKey,
  senderEmail,
  senderName = "Orbito Whiteboard",
  timeoutMs = requestTimeoutMs
}: BrevoHttpEmailSenderDependencies): EmailSender => {
  return async (email: OutgoingEmail) => {
    try {
      const response = await fetch(brevoApiUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: email.recipient }],
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        console.error(`[BREVO ERROR] Status ${String(response.status)}:`, errorText);
        throw new Error(`Email delivery failed (Brevo ${String(response.status)}: ${errorText || response.statusText})`);
      }

      console.log(`[BREVO SUCCESS] Sent to ${email.recipient}`);
    } catch (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${email.recipient}:`, error);
      throw error;
    }
  };
};
