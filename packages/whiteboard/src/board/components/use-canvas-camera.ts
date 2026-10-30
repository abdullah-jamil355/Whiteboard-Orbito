"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Board } from "..";
import { getObjectBounds } from "../object-operations";
import {
  BASE_CANVAS_HEIGHT,
  BASE_CANVAS_WIDTH,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  type CanvasBounds,
  type CanvasCamera
} from "./canvas-model";
import { createCanvasZoomHandler } from "./canvas-camera.js";

type UseCanvasCameraProps = Readonly<{
  board: Board;
  onCameraChange?: ((camera: CanvasCamera) => void) | undefined;
}>;

export const useCanvasCamera = ({ board, onCameraChange }: UseCanvasCameraProps) => {
  const canvasElementRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<CanvasBounds>({
    width: BASE_CANVAS_WIDTH,
    height: BASE_CANVAS_HEIGHT
  });
  const [cameraState, setCameraState] = useState<Readonly<{ boardId: string; camera: CanvasCamera }>>({
    boardId: "",
    camera: { x: 0, y: 0, zoom: 1 }
  });
  const [spacePressed, setSpacePressed] = useState(false);

  const defaultCamera = useMemo<CanvasCamera>(() => {
    if (board.templateId !== "blank" && board.templateId !== "" && board.objects.length > 0) {
      const objectBounds = board.objects.map(getObjectBounds);
      const content = {
        left: Math.min(...objectBounds.map(({ left }) => left)),
        top: Math.min(...objectBounds.map(({ top }) => top)),
        right: Math.max(...objectBounds.map(({ right }) => right)),
        bottom: Math.max(...objectBounds.map(({ bottom }) => bottom))
      };
      const contentWidth = Math.max(1, content.right - content.left);
      const contentHeight = Math.max(1, content.bottom - content.top);
      const fitZoom = Math.min(
        (viewportSize.width * 0.75) / contentWidth,
        (viewportSize.height * 0.75) / contentHeight
      );
      const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, fitZoom));
      const centerX = (content.left + content.right) / 2;
      const centerY = (content.top + content.bottom) / 2;
      return {
        x: centerX - viewportSize.width / zoom / 2,
        y: centerY - viewportSize.height / zoom / 2,
        zoom
      };
    }
    return {
      x: BASE_CANVAS_WIDTH / 2 - viewportSize.width / 2,
      y: BASE_CANVAS_HEIGHT / 2 - viewportSize.height / 2,
      zoom: 1
    };
  }, [board.objects, board.templateId, viewportSize.height, viewportSize.width]);

  const camera = cameraState.boardId === board.id ? cameraState.camera : defaultCamera;

  const setCamera = useCallback<Dispatch<SetStateAction<CanvasCamera>>>(
    (nextCamera) => {
      setCameraState((current) => {
        const currentCamera = current.boardId === board.id ? current.camera : defaultCamera;
        return {
          boardId: board.id,
          camera: typeof nextCamera === "function" ? nextCamera(currentCamera) : nextCamera
        };
      });
    },
    [board.id, defaultCamera]
  );

  useEffect(() => {
    const canvas = canvasElementRef.current;
    if (canvas === null) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const nextSize = {
        width: Math.max(1, Math.round(entry.contentRect.width - 21)),
        height: Math.max(1, Math.round(entry.contentRect.height - 14))
      };
      setViewportSize((current) =>
        current.width === nextSize.width && current.height === nextSize.height ? current : nextSize
      );
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);

  const changeZoom = useMemo(
    () => createCanvasZoomHandler(viewportSize, setCamera),
    [viewportSize, setCamera]
  );

  useEffect(() => {
    const handleZoomShortcut = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"))
      ) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
        event.preventDefault();
        changeZoom(1.25);
      } else if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
        event.preventDefault();
        changeZoom(0.8);
      }
    };
    window.addEventListener("keydown", handleZoomShortcut);
    return () => window.removeEventListener("keydown", handleZoomShortcut);
  }, [changeZoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, [role='textbox']"))
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") setSpacePressed(false);
    };
    const handleWindowBlur = (): void => setSpacePressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return {
    camera,
    canvasElementRef,
    changeZoom,
    defaultCamera,
    setCamera,
    spacePressed,
    viewportSize
  };
};
