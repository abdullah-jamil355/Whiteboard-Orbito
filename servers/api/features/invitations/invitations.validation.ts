import { z } from "zod";
export const createInvitationSchema = z.object({ email: z.email().max(254), role: z.enum(["editor", "viewer"]) }).strict();
export const acceptInvitationSchema = z.object({ token: z.string().min(32).max(256), displayName: z.string().trim().min(1).max(80) }).strict();
