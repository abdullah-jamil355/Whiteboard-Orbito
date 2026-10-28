export { createBrevoHttpEmailSender } from "./email.brevo-http.js";
export { createGmailSmtpEmailSender } from "./email.gmail-smtp.js";
export { createGoogleOAuthIntegration } from "./email.google-oauth.js";
export type { GoogleMailIdentity, GoogleOAuthConfiguration } from "./email.google-oauth.js";
export type { EmailSender, OutgoingEmail } from "./email.contracts.js";
