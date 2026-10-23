import type { ReactElement } from "react";
import { CanvasLineGraphic } from "./canvas-line-graphic";
import { renderCanvasColor, type PreviewLine } from "./canvas-model";

type CanvasLinePreviewProps = Readonly<{ line: PreviewLine | null }>;

export const CanvasLinePreview = ({ line }: CanvasLinePreviewProps): ReactElement | null => {
  if (line === null) return null;
  return <CanvasLineGraphic start={line.start} end={line.end} color={renderCanvasColor(line.color)} lineWeight={line.lineWeight} routing={line.routing ?? (line.type === "connector" ? "orthogonal" : "straight")} startArrow={line.startArrow ?? "none"} endArrow={line.endArrow ?? (line.type === "arrow" ? "open" : "none")} />;
};

