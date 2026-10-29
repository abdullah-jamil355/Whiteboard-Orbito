import type { ReactElement } from "react";
import type { CollaboratorPresence } from "./canvas-model.js";

type CanvasCollaboratorCursorsProps = Readonly<{
  collaborators: readonly CollaboratorPresence[];
  zoom: number;
}>;

export const CanvasCollaboratorCursors = ({
  collaborators,
  zoom
}: CanvasCollaboratorCursorsProps): ReactElement => {
  return (
    <>
      {collaborators.flatMap((participant) => {
        if (participant.cursor === null) return [];
        const { cursor, name, clientId } = participant;
        const color = ["#ff6b6b", "#42b883", "#7c6dfa", "#f59e0b", "#06b6d4", "#ec4899"][Math.abs(clientId) % 6] ?? "#7c6dfa";
        const labelWidth = Math.min(180, Math.max(54, name.length * 7 + 16));
        return [(
          <g
            aria-label={`${name} cursor`}
            key={`cursor-${clientId}`}
            pointerEvents="none"
            style={{ transition: "transform 0.04s linear" }}
            transform={`translate(${cursor.x} ${cursor.y}) scale(${1 / zoom})`}
          >
            <path d="M 0 0 L 0 17 L 5 12 L 10 21 L 14 19 L 9 10 L 17 10 Z" fill={color} stroke="#ffffff" strokeWidth="1.5" />
            <rect fill={color} height="22" rx="5" width={labelWidth} x="15" y="12" />
            <text fill="#ffffff" fontSize="12" fontWeight="600" x="22" y="27">{name.slice(0, 24)}</text>
          </g>
        )];
      })}
    </>
  );
};
