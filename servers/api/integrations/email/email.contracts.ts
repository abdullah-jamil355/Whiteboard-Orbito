export type OutgoingEmail = Readonly<{
  recipient: string;
  subject: string;
  html: string;
  text: string;
}>;

export type EmailSender = (email: OutgoingEmail) => Promise<void>;
