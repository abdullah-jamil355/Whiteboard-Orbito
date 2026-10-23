"use client";

import { useEffect, useEffectEvent, type ReactElement } from "react";
import { X } from "lucide-react";

type WorkspaceFeedbackProps = Readonly<{ kind: "error" | "success"; message: string; onDismiss: () => void }>;

export const WorkspaceFeedback = ({ kind, message, onDismiss }: WorkspaceFeedbackProps): ReactElement => {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    const timeoutId = window.setTimeout(dismiss, 12_000);
    return () => window.clearTimeout(timeoutId);
  }, [kind, message]);

  return (
    <div className={`wb-file-feedback wb-file-feedback-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{message}</span>
      <button aria-label="Dismiss notification" className="wb-notification-dismiss" onClick={onDismiss} title="Dismiss notification" type="button">
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
};
