import React, { type ReactElement } from "react";
import type { ArrowHead, ConnectorRouting, WhiteboardTool } from "../board";

export type WaypointStyleItem = Readonly<{
  id: string;
  label: string;
  description: string;
  routing: ConnectorRouting;
}>;

export const WAYPOINT_STYLES: readonly WaypointStyleItem[] = [
  { id: "orthogonal", label: "Orthogonal Waypoints", description: "Right-angle horizontal and vertical bends", routing: "orthogonal" },
  { id: "curved", label: "Curved Waypoints", description: "Smooth bezier curve routing through waypoints", routing: "curved" },
  { id: "straight", label: "Straight Waypoints", description: "Direct point-to-point lines between waypoints", routing: "straight" }
];

export type ConnectorStyleItem = Readonly<{
  id: string;
  label: string;
  description: string;
  tool: WhiteboardTool;
  routing: ConnectorRouting;
  startArrow: ArrowHead;
  endArrow: ArrowHead;
}>;

export const CONNECTOR_STYLES: readonly ConnectorStyleItem[] = [
  { id: "directed-arrow", label: "Directed Arrow", description: "Straight line with sleek arrowhead", tool: "arrow", routing: "straight", startArrow: "none", endArrow: "block" },
  { id: "orthogonal-connector", label: "Orthogonal Connector", description: "Elbow right-angle route with arrowhead", tool: "connection", routing: "orthogonal", startArrow: "none", endArrow: "block" },
  { id: "straight-line", label: "Plain Line", description: "Simple straight line without arrows", tool: "line", routing: "straight", startArrow: "none", endArrow: "none" },
  { id: "bidirectional-arrow", label: "Bidirectional Arrow", description: "Arrowheads at both start and end", tool: "arrow", routing: "straight", startArrow: "block", endArrow: "block" },
  { id: "open-arrow", label: "Open Arrow", description: "Clean chevron open arrowhead", tool: "arrow", routing: "straight", startArrow: "none", endArrow: "open" },
  { id: "curved-connector", label: "Curved Connector", description: "Smooth curved line with arrowhead", tool: "connection", routing: "curved", startArrow: "none", endArrow: "block" },
  { id: "circle-endpoint", label: "Circle Endpoint", description: "Line with circular terminal point", tool: "connector", routing: "straight", startArrow: "none", endArrow: "circle" },
  { id: "diamond-endpoint", label: "Diamond Endpoint", description: "Line with diamond aggregation point", tool: "connector", routing: "straight", startArrow: "none", endArrow: "diamond" }
];

export const WaypointIcon = ({ id }: { id: string }): ReactElement => {
  switch (id) {
    case "orthogonal":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <path d="M 8 23 L 8 9 L 40 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <circle cx="8" cy="9" fill="#0284c7" r="3.5" stroke="#ffffff" strokeWidth="1.5" />
          <circle cx="24" cy="9" fill="#38bdf8" r="2.5" stroke="#ffffff" strokeWidth="1" />
        </svg>
      );
    case "curved":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <path d="M 6 22 C 18 26 22 8 42 8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <circle cx="22" cy="15" fill="#0284c7" r="3.5" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );
    case "straight":
    default:
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="42" y1="15" y2="15" />
          <circle cx="24" cy="15" fill="#0284c7" r="3.5" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      );
  }
};

export const ConnectorIcon = ({ id }: { id: string }): ReactElement => {
  switch (id) {
    case "directed-arrow":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="36" y1="15" y2="15" />
          <path d="M 32 10 L 41 15 L 32 20 Z" fill="currentColor" />
        </svg>
      );
    case "orthogonal-connector":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <path d="M 8 23 L 8 10 L 36 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          <path d="M 32 5 L 41 10 L 32 15 Z" fill="currentColor" />
        </svg>
      );
    case "straight-line":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="42" y1="15" y2="15" />
        </svg>
      );
    case "bidirectional-arrow":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeWidth="2" x1="12" x2="36" y1="15" y2="15" />
          <path d="M 16 10 L 7 15 L 16 20 Z M 32 10 L 41 15 L 32 20 Z" fill="currentColor" />
        </svg>
      );
    case "open-arrow":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="40" y1="15" y2="15" />
          <path d="M 32 9 L 41 15 L 32 21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      );
    case "curved-connector":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <path d="M 6 22 C 18 22 18 8 36 8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <path d="M 32 3 L 41 8 L 32 13 Z" fill="currentColor" />
        </svg>
      );
    case "circle-endpoint":
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="33" y1="15" y2="15" />
          <circle cx="38" cy="15" fill="currentColor" r="4.5" />
        </svg>
      );
    case "diamond-endpoint":
    default:
      return (
        <svg aria-hidden="true" className="wb-toolbar-popover-icon" fill="none" viewBox="0 0 48 30">
          <line stroke="currentColor" strokeLinecap="round" strokeWidth="2" x1="6" x2="32" y1="15" y2="15" />
          <path d="M 32 15 L 37 10 L 42 15 L 37 20 Z" fill="currentColor" />
        </svg>
      );
  }
};
