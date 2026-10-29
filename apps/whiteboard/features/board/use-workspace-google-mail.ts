"use client";

import { useEffect, useState } from "react";
import {
  disconnectGoogleMail,
  getGoogleMailStatus,
  startGoogleMailConnect,
  signOut,
  type GoogleMailStatus,
  type VerifiedIdentity
} from "./api-client";

const getGoogleMailCallbackFeedback = (): string | null => {
  if (typeof window === "undefined") return null;
  const result = new URLSearchParams(window.location.search).get("google-mail");
  if (result === "connected") {
    return "Gmail connected. Session invitations will be sent from your Whiteboard email address.";
  }
  if (result === "account-mismatch") {
    return "Connect the same Gmail address you used to sign in to Whiteboard.";
  }
  return result === null ? null : "Gmail could not be connected. Check the Google consent and API settings, then try again.";
};

type UseWorkspaceGoogleMailProps = Readonly<{
  identity: VerifiedIdentity | null;
  setCurrentOwnerId: (id: string | null) => void;
  setIdentity: (identity: VerifiedIdentity | null) => void;
  setSessionFeedback: (feedback: string | null) => void;
}>;

export const useWorkspaceGoogleMail = ({
  identity,
  setCurrentOwnerId,
  setIdentity,
  setSessionFeedback
}: UseWorkspaceGoogleMailProps) => {
  const [googleMailState, setGoogleMailState] = useState<Readonly<{
    identityId: string;
    status: GoogleMailStatus | null;
  }> | null>(null);

  const googleMail = identity !== null && googleMailState?.identityId === identity.id
    ? googleMailState.status
    : null;

  useEffect(() => {
    if (identity === null) return;
    let isCurrent = true;
    void getGoogleMailStatus()
      .then((status) => {
        if (isCurrent) setGoogleMailState({ identityId: identity.id, status });
      })
      .catch(() => {
        if (isCurrent) setGoogleMailState({ identityId: identity.id, status: null });
      });
    return () => {
      isCurrent = false;
    };
  }, [identity]);

  useEffect(() => {
    const callbackFeedback = getGoogleMailCallbackFeedback();
    if (callbackFeedback !== null) setSessionFeedback(callbackFeedback);
    if (new URLSearchParams(window.location.search).has("google-mail")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setSessionFeedback]);

  const handleSignOut = (): void => {
    void signOut()
      .then(() => {
        setIdentity(null);
        setCurrentOwnerId(null);
      })
      .catch((error: unknown) =>
        setSessionFeedback(error instanceof Error ? error.message : "Sign out failed.")
      );
  };

  const handleConnectGoogleMail = (): void => {
    void startGoogleMailConnect()
      .then(({ authorizationUrl }) => window.location.assign(authorizationUrl))
      .catch((error: unknown) =>
        setSessionFeedback(error instanceof Error ? error.message : "Could not start Gmail connection.")
      );
  };

  const handleDisconnectGoogleMail = (): void => {
    void disconnectGoogleMail()
      .then(() => {
        if (identity !== null) {
          setGoogleMailState({
            identityId: identity.id,
            status: { configured: true, connected: false }
          });
        }
      })
      .catch((error: unknown) =>
        setSessionFeedback(error instanceof Error ? error.message : "Could not disconnect Gmail.")
      );
  };

  return {
    googleMail,
    handleConnectGoogleMail,
    handleDisconnectGoogleMail,
    handleSignOut
  };
};
