import type { Dispatch, SetStateAction } from "react";
import type { CanvasBounds, CanvasCamera } from "./canvas-model";
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "./canvas-model";

export const createCanvasZoomHandler = (
  bounds: CanvasBounds,
  setCamera: Dispatch<SetStateAction<CanvasCamera>>
): ((factor: number) => void) => (factor) => {
  setCamera((current) => {
    const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, current.zoom * factor));
    const centerX = current.x + bounds.width / current.zoom / 2;
    const centerY = current.y + bounds.height / current.zoom / 2;
    return { zoom, x: centerX - bounds.width / zoom / 2, y: centerY - bounds.height / zoom / 2 };
  });
};
