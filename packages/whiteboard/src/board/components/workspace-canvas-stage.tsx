import type { ReactElement } from "react";
import { WhiteboardCanvas } from "./whiteboard-canvas";
import type { WhiteboardCanvasProps } from "./canvas-model";

export const WorkspaceCanvasStage = (props: WhiteboardCanvasProps): ReactElement => (
  <section className="wb-stage" aria-label="Board canvas area">
    <WhiteboardCanvas {...props} />
  </section>
);
