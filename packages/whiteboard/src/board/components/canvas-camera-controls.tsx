import type { ReactElement } from "react";
import { Maximize } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";

type CanvasCameraControlsProps = Readonly<{
  disabled?: boolean;
  onFit: () => void;
}>;

export const CanvasCameraControls = ({ disabled = false, onFit }: CanvasCameraControlsProps): ReactElement => (
  <div className="wb-camera-controls" role="group" aria-label="Canvas navigation">
    <Button aria-label="Reset canvas view" disabled={disabled} onClick={onFit} size="icon" title="Reset canvas view" variant="outline"><Maximize /></Button>
  </div>
);
