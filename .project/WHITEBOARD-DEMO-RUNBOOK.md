# Whiteboard $0 Demo Runbook

This runbook prepares a repeatable local senior demo. It does not claim production availability, backup guarantees, or that a configured cloud database plan is free. Check the selected MongoDB Atlas project's current tier, quota, backup settings, and billing status in its console before using it for a demo. If cost is uncertain, show the local-only editor and XML workflow; do not enable a paid tier or overage.

## Before the demo

- Use Node.js 22 or newer and pnpm 11.19 from the repository root.
- Copy `apps/whiteboard/.env.example` to `apps/whiteboard/.env.local` and `servers/api/.env.example` to `servers/api/.env` only when demonstrating server-backed sessions. Keep real values local; never paste them into chat, screenshots, logs, or source control.
- Configure API `WEB_ORIGIN` to exactly match the app's running origin, including the port. Configure `MONGODB_URI` and a random 256-bit `IDENTITY_RATE_LIMIT_KEY` on the API only. The app receives only the API origin and WebSocket URL.
- For invitations from each session owner Gmail, configure Google OAuth in servers/api/.env and add each tester account to the Google OAuth consent screen, following the backend runbook. Owners must click Connect Gmail before inviting. Optional GMAIL_USER/GMAIL_APP_PASSWORD settings send sign-in links only. Without OAuth setup, invitations fail closed; development sign-in falls back to the local mailbox.
- Confirm MongoDB cost/quotas and test that the API reports a successful database connection. The runbook does not assume Atlas free-tier availability.
- Keep the development mailbox in loopback-only development mode as the sign-in fallback. It is in-memory, is not an email provider, and is cleared when the API restarts.
- Start the API and app in separate terminals:

  ```powershell
  pnpm.cmd --dir servers/api run dev
  pnpm.cmd --dir apps/whiteboard run dev
  ```

- Open the URL printed by the Whiteboard dev server. The usual local URL is `http://localhost:3000`; use the printed URL if the port changed.

## Demo flow

1. Show the standalone board, choose a built-in template, and point out that the template opens as an editable independent copy.
2. Add a shape, label, connector, and pen stroke. Move an object and show Undo/Redo.
3. Choose **Save XML**, then open the downloaded file. Explain that normal boards are saved by an explicit local download and are not automatically synced to the cloud.
4. For the backend portion, sign in using the configured Gmail inbox, or use the local development mailbox if Gmail SMTP is not configured. Start the single **Live Collaboration** session feature.
5. Invite a second test identity; after the owner connects Gmail, accept the one-time link received at that address; the local mailbox exercises sign-in only. For a second physical device, follow the LAN host setup in the backend runbook; a `localhost` link cannot open the owner's app from another device. Demonstrate the assigned role and shared board only if the authenticated two-browser checks have been rehearsed successfully for this build. Otherwise, show the implemented API checks and clearly label the browser flow as unverified.
6. End the session through the owner controls and confirm the explicit end choice. Do not leave a demo session active after the rehearsal.

## Demo limits to state plainly

| Area | Current boundary |
| --- | --- |
| Local app/API processes | They run on the demo machine. Closing or restarting them interrupts active sockets and local mailbox contents. |
| Session board data | Accepted board edits persist in MongoDB; recovery loads the latest snapshot and replays later operations. Repository recovery has been exercised, but a live API/Hocuspocus process restart with connected browsers remains unverified. |
| MongoDB plan | Capacity, cost, backups, restore windows, and retention depend on the selected Atlas project configuration. Verify these in the Atlas console; this document makes no free-tier or backup promise. |
| Email | Each owner can connect Gmail through local OAuth and send session invites from that account. Optional shared Gmail App Password is for sign-in links; otherwise development sign-in uses the loopback-only mailbox. Production OAuth verification is not configured. |
| Active session lifetime | Sessions have no time limit and remain active until the owner explicitly ends them. There is no expiry monitor. Atlas backup retention still needs verification before public exposure. |
| Data deletion | Ending a session revokes access and removes active session records through retryable cleanup. Backup deletion behavior depends on the database plan and is not promised here. |
| Browser verification | API/unit and direct database checks pass. Authenticated cross-browser role, reconnect, removal, and restart behavior still needs a rehearsed browser verification pass. |

## Stop conditions

- If the database is unavailable, the API reports a persistence failure, or the app shows queued/rejected edits, do not describe the board as server-saved. Use the local XML demo path instead.
- If an invitation email is missing, verify that the session owner connected Gmail, is listed as an OAuth test user, and that Google OAuth client settings and Gmail API access are valid; reconnect if the test authorization expired. For missing sign-in links, check the configured shared sender or loopback-only development mailbox. Do not use credentials from the example file as real secrets.
- If the Atlas plan or its billing state is unclear, do not start a live-session demo against it.

## Related references

- Local setup and editor behavior: `apps/whiteboard/README.md`
- Backend operations and failure responses: `WHITEBOARD-BACKEND-RUNBOOK.md`
- Current implementation and release gates: `WHITEBOARD-IMPLEMENTATION-BACKLOG.md`
