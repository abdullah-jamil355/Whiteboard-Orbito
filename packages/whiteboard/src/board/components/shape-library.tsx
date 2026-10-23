import type { ReactElement } from "react";
import type { ShapeKind } from "../board";
import { CanvasShape } from "./canvas-shape";

export const SHAPE_LIBRARY_GROUPS = [
  {
    name: "General",
    shapes: [
      { shape: "rectangle", label: "Rectangle" },
      { shape: "rounded-rectangle", label: "Rounded rectangle" },
      { shape: "circle", label: "Circle" },
      { shape: "diamond", label: "Diamond" },
      { shape: "triangle", label: "Triangle" },
      { shape: "hexagon", label: "Hexagon" },
      { shape: "parallelogram", label: "Parallelogram" },
      { shape: "trapezoid", label: "Trapezoid" }
    ]
  },
  {
    name: "Basic",
    shapes: [
      { shape: "pentagon", label: "Pentagon" },
      { shape: "octagon", label: "Octagon" },
      { shape: "star", label: "Star" },
      { shape: "cross", label: "Cross" },
      { shape: "cylinder", label: "Cylinder" },
      { shape: "cloud", label: "Cloud" },
      { shape: "document", label: "Document" },
      { shape: "speech-bubble", label: "Speech bubble" }
    ]
  },
  {
    name: "Arrows",
    shapes: [
      { shape: "right-arrow", label: "Right arrow" },
      { shape: "left-arrow", label: "Left arrow" },
      { shape: "up-arrow", label: "Up arrow" },
      { shape: "down-arrow", label: "Down arrow" },
      { shape: "double-arrow", label: "Double arrow" },
      { shape: "left-right-arrow", label: "Left-right arrow" }
    ]
  }
] as const satisfies readonly Readonly<{ name: string; shapes: readonly Readonly<{ shape: ShapeKind; label: string }>[] }>[];

export const ShapeLibraryIcon = ({ shape }: Readonly<{ shape: ShapeKind }>): ReactElement => (
  <svg aria-hidden="true" className="wb-shape-library-icon" viewBox="0 0 48 36">
    <CanvasShape fill="none" geometry={{ x: 3, y: 3, width: 42, height: 30 }} shape={shape} stroke="currentColor" strokeWidth={2.4} />
  </svg>
);
