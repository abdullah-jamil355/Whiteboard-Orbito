import type { ReactElement } from "react";
import { Shapes } from "lucide-react";

type CanvasEmptyStateProps = Readonly<{
  show: boolean;
}>;

export const CanvasEmptyState = ({ show }: CanvasEmptyStateProps): ReactElement | null => {
  if (!show) return null;
  return (
    <div className="wb-canvas-empty">
      <span className="wb-empty-illustration" aria-hidden="true">
        <Shapes size={42} />
      </span>
      <strong>Your canvas is ready</strong>
      <p>Choose the pen, sticky note, text, or a shape tool to add content.</p>
    </div>
  );
};
