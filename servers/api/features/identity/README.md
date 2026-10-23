# Whiteboard Identity Feature Contract

## Ownership

This API feature owns Whiteboard email identity, one-time magic-link challenges, authenticated cookie sessions, and the local development mail inbox. Board-session lifecycle is owned by `features/sessions`; invitation and durable participant membership are owned by `features/invitations`. Those features resolve the verified identity from this feature and apply their own session, role, and membership checks. Identity never treats browser-supplied email, identity IDs, roles, or room IDs as authenticated identity.

## Current HTTP contract

All browser mutations require an exact `Origin` match with configured `WEB_ORIGIN`.

| Method and path | Behavior |
|---|---|
| `POST /auth/magic-links` | Accepts `{ "email": "..." }`; creates a ten-minute one-time link; responds with the same generic `202` message for eligible email addresses. |
| `POST /auth/magic-links/consume` | Accepts `{ "token": "..." }`; atomically consumes a valid challenge and sets an opaque server-session cookie. |
| `GET /auth/session` | Resolves the HttpOnly `wb_session` cookie and returns the verified identity. |
| `DELETE /auth/session` | Revokes the current server-side session and clears the cookie. |
| `POST /auth/google-mail/connect` | Same-origin authenticated request; creates single-use OAuth state and returns the Google consent URL. |
| `GET /auth/google-mail/callback` | Verifies the state against the currently authenticated Whiteboard identity, exchanges the authorization code, and stores the encrypted sender credential. |
| `GET /auth/google-mail/status` | Returns whether this identity has connected a Gmail sender and its verified sender address. |
| `DELETE /auth/google-mail/connection` | Same-origin authenticated request; revokes the Google refresh token best-effort and removes its encrypted local copy. |
| `POST /__dev/mailbox` | Development-only local inbox; accepts `{ "email": "..." }`, registered only when `NODE_ENV=development` and API binds to a loopback host. Email is kept out of request URLs/access logs. It returns private verification URLs and must never be enabled for a deployed environment. |

The cookie is host-only, `HttpOnly`, `SameSite=Lax`, path `/`, and seven days maximum age; it is `Secure` in production. This is an implementation default, not yet a product/security-approved lifetime. The database stores only SHA-256 hashes of high-entropy tokens. Production configuration must provide a stable 32-byte `IDENTITY_RATE_LIMIT_KEY` encoded as 64 hex characters; local development may use a process-random key. Keep the app and API on the same site (for local development, use `localhost` consistently) so the Lax cookie is sent on authenticated requests.

Magic-link tokens are placed in the URL fragment (`#token=...`), not its query string, so the browser does not send the credential in the HTTP request URL or `Referer`. The verification page reads the fragment and removes it from browser history before consuming the token.

## Rate and data policy

- The API applies shared fixed-window limits of 300 HTTP requests per minute per session-cookie bucket and 1,800 per source-IP bucket. Requests without a valid session cookie use the IP bucket for both limits. `/health` is exempt. Raw cookie/IP values are HMACed before MongoDB counters are stored, so API restarts and replicas share the windows without persisting those identifiers. Behind a reverse proxy, configure `API_TRUST_PROXY_HOPS` to the exact trusted hop count and prevent bypassing that proxy.
- If MongoDB cannot reserve an API request counter, the API fails closed with `503` (health remains available). A rate-limited request receives `429` and `Retry-After` for the remainder of its minute window.
- Magic-link requests are limited to 3 per normalized email and 10 per source IP in a fixed 15-minute window; rate-limited responses include `Retry-After` for the current window boundary.
- Rate-limit keys are HMAC-SHA-256 values; raw IP addresses are not stored for this purpose.
- MongoDB atomic counters enforce the limits across API restarts/instances. Expired counter records are retained for one hour for cleanup.
- Magic links expire after ten minutes; acceptance checks the exact timestamp and single-use state in MongoDB. Session expiry is also checked on each request.
- MongoDB TTL indexes remove expired challenge/session/rate-limit records asynchronously. Logical expiry is enforced immediately by queries, independent of TTL cleanup timing.
- The development mailbox is process memory only and is a local testing substitute; it is not email delivery and is not part of the production identity contract.

## Dependencies and failure behavior

Identity endpoints require configured and connected MongoDB. Without `MONGODB_URI`, they return service unavailable and the existing health endpoint remains usable. On startup with MongoDB configured, the API creates identity, challenge, rate-limit, session, and Google-mail connection indexes before listening; index creation failure prevents the API from accepting traffic. `GMAIL_USER` and `GMAIL_APP_PASSWORD`, when configured, send sign-in verification links only. Each Whiteboard identity can separately connect its own Gmail using Google OAuth; the refresh token is encrypted at rest and only that identity's session owner can send invitations from it. OAuth requires the client ID, client secret, exact callback URI, and 32-byte token-encryption key. Without those OAuth settings, invitation sending is disabled. When shared Gmail settings are absent, development sign-in links use the local mailbox, while production sign-in delivery fails closed. Do not claim that an email was sent when its delivery adapter is unavailable.

Session, invitation, and realtime features use the verified identity from this feature and enforce their own owner/membership/role rules. Returning participants can enumerate only active sessions containing their authenticated identity; session reads and room joins check current membership again. Keep authentication responses `Cache-Control: no-store`; do not log tokens, cookies, verification URLs, or raw request bodies.
