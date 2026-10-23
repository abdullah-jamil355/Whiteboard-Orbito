# Whiteboard Invitation Feature Contract

## Ownership

This feature owns private session invitations and the accepted membership record. It stores a cryptographic token hash, normalized recipient email, session ID, fixed role, issue/expiry times, cancellation, acceptance identity, and display name in MongoDB. Identity verification stays in `features/identity`; session ownership and active status stay in `features/sessions`.

## HTTP contract

Mutations require the configured exact `Origin` and verified HttpOnly `wb_session` cookie. The application never returns the invitation token in JSON. The invite URL carries its one-time token in a URL fragment, which is not sent in HTTP requests or referrers by default.

| Method and path | Behavior |
|---|---|
| `POST /sessions/:sessionId/invitations` | Owner-only; normalized email; requires an explicit Editor or Viewer role; issues a one-time link with a ten-minute expiry. |
| `GET /sessions/:sessionId/invitations` | Owner-only pending, unexpired invitation summary; never includes token hashes. |
| `DELETE /sessions/:sessionId/invitations/:invitationId` | Owner-only, atomic cancellation of a pending invite. |
| `GET /sessions/:sessionId/members` | Owner-only active participant list with fixed role, display name/email, and current socket connection state. |
| `DELETE /sessions/:sessionId/members/:identityId` | Owner-only revocation; atomically removes accepted membership and its leases, then closes the participant's sockets. |
| `POST /invitations/accept` | Requires an already verified identity cookie; atomically consumes a matching one-time invitation and stores identity/name/role membership. |

Each session owner must connect a Gmail account before sending invitations. `POST /auth/google-mail/connect` starts a state-bound Google OAuth authorization flow; the callback is bound to the same authenticated Whiteboard identity. Only the `gmail.send` scope is requested. Refresh tokens are AES-256-GCM encrypted before MongoDB storage; the encryption key is supplied by the API environment and is never returned to clients. The connected Gmail address must exactly match the owner's verified Whiteboard sign-in email; accounts cannot be connected across identities. Invitations are sent synchronously through the Gmail API with a 15-second HTTP timeout. Without a connected sender or configured Google OAuth client, invitation delivery fails closed and the pending invite is canceled. Shared `GMAIL_USER`/`GMAIL_APP_PASSWORD` settings, if used, apply only to sign-in mail. MongoDB rate counters cap invitation creation/acceptance at 10 per identity and 30 per source IP per fixed 15-minute window. Pending invites do not reserve member slots.

## Authorization and limits

- The server verifies session ownership on create/list/cancel and checks that the session is Active.
- Acceptance requires an existing authenticated identity whose normalized email matches the intended recipient. An email mismatch is indistinguishable from an invalid, expired, or reused token.
- Invitation tokens are stored only as SHA-256 hashes and consumed with a conditional atomic update. MongoDB has TTL cleanup; query predicates enforce expiry immediately.
- Acceptance atomically consumes the invite and adds the verified identity to the session's durable member list in one MongoDB transaction. The owner plus at most 24 invitees (25 total) can join; additional accepted membership attempts receive a safe `409` and the invite remains pending. Disconnecting does not remove membership or free a slot. A member can reconnect until the owner ends the session. Removal cancels the accepted invitation, removes member identity and active socket leases transactionally, and closes tracked connections; a new invitation is required to rejoin and occupies an available member slot.
- Membership enables authenticated reads of the active session snapshot and realtime room authorization. The owner-only roster reports fixed role and current server-tracked socket connection state. Editor and Viewer roles apply to every Live Collaboration invitation and are fixed on acceptance; role changes require removal and a new invitation.
- On mail delivery failure, the pending invite is canceled; its token is not shown to the owner. Retry remains subject to the rate limit.
- The email contains an **Accept invitation** link, the session title, and the expiry time. The one-time token remains in the URL fragment and is never returned by the API.

## Operations

- Invitation rate-limit signal: HTTP `429` from invitation create/accept endpoints. Threshold: more than 10 invitation `429`s from one source IP in a 15-minute window, or repeated bursts across IPs, is actionable. Investigate using hashed limiter keys only, keep limits active, and pause invitation creation if abuse continues.
- Expiration cleanup is asynchronous MongoDB TTL work for pending invitations; exact expiration is enforced synchronously. On acceptance, the expiry TTL is removed because membership must persist until removal or session end. If expired pending rows remain more than 15 minutes beyond expiry, verify the TTL index and MongoDB TTL monitor; do not loosen request expiry checks.
- Delivery signal: the API request log records `503` for `POST /sessions/:sessionId/invitations` when the owner has no connected Gmail account, Google token refresh fails, or Gmail API rejects/times out; no credentials, recipient, invite URL, or token is logged. Threshold: any delivery `503` is actionable because the pending invitation is canceled. Response: have the owner connect/reconnect Gmail, verify Google OAuth client settings and API availability, then resend. Never copy OAuth tokens, client secrets, invitation URLs, or one-time tokens into logs or support messages.
