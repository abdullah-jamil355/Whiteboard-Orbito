import type { ReactElement } from "react";
import { CornerDownRight, Waypoints } from "lucide-react";
import type {
  ArrowHead,
  ConnectorRouting,
  WhiteboardTool
} from "..";
import { CONNECTOR_STYLES, WAYPOINT_STYLES, ConnectorIcon, WaypointIcon } from "./connector-library";

export {
  ToolbarShapesMenu,
  ToolbarStickyNoteMenu,
  type ShapesMenuProps,
  type StickyNoteMenuProps,
} from "./workspace-toolbar-palette-menus";

type ToolbarMenuKind = "shapes" | "waypoints" | "connectors" | "note";

type WaypointsMenuProps = Readonly<{
  connectorRouting: ConnectorRouting;
  isOpen: boolean;
  onSelect: (routing: ConnectorRouting) => void;
  onToggle: () => void;
  selectedTool: WhiteboardTool;
}>;

export const ToolbarWaypointsMenu = ({
  connectorRouting,
  isOpen,
  onSelect,
  onToggle,
  selectedTool
}: WaypointsMenuProps): ReactElement => {
  return (
    <details
      className="wb-shape-library wb-waypoints-library"
      data-active={selectedTool === "waypoints"}
      open={isOpen}
    >
      <summary
        aria-label="Open waypoints routing styles"
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
        title="Draw.io Waypoints and routing styles"
      >
        <Waypoints />
        <span aria-hidden="true">Waypoints</span>
      </summary>
      <div className="wb-toolbar-popover-menu">
        <div className="wb-popover-header">
          <strong>Draw.io Waypoints & Routing</strong>
          <p>Choose routing style to bend lines through waypoints</p>
        </div>
        <div className="wb-popover-grid">
          {WAYPOINT_STYLES.map((item) => (
            <button
              aria-label={`${item.label} waypoints`}
              aria-pressed={connectorRouting === item.routing && selectedTool === "waypoints"}
              className="wb-toolbar-popover-item"
              key={item.id}
              onClick={() => onSelect(item.routing)}
              type="button"
            >
              <WaypointIcon id={item.id} />
              <div className="wb-popover-item-text">
                <span className="wb-popover-item-title">{item.label}</span>
                <span className="wb-popover-item-desc">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
};

type ConnectorsMenuProps = Readonly<{
  connectorRouting: ConnectorRouting;
  isOpen: boolean;
  lineEndArrow: ArrowHead;
  onSelect: (selection: {
    endArrow: ArrowHead;
    routing: ConnectorRouting;
    startArrow: ArrowHead;
    tool: WhiteboardTool;
  }) => void;
  onToggle: () => void;
  selectedTool: WhiteboardTool;
}>;

export const ToolbarConnectorsMenu = ({
  connectorRouting,
  isOpen,
  lineEndArrow,
  onSelect,
  onToggle,
  selectedTool
}: ConnectorsMenuProps): ReactElement => {
  const isConnectorActive =
    selectedTool === "connection" ||
    selectedTool === "connector" ||
    selectedTool === "arrow" ||
    selectedTool === "line";

  return (
    <details
      className="wb-shape-library wb-connectors-library"
      data-active={isConnectorActive}
      open={isOpen}
    >
      <summary
        aria-label="Open connectors library"
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
        title="Draw.io Connectors and Arrows"
      >
        <CornerDownRight />
        <span aria-hidden="true">Connector</span>
      </summary>
      <div className="wb-toolbar-popover-menu">
        <div className="wb-popover-header">
          <strong>Draw.io Connectors & Arrows</strong>
          <p>Choose connector style to draw and snap between shapes</p>
        </div>
        <div className="wb-popover-grid">
          {CONNECTOR_STYLES.map((item) => (
            <button
              aria-label={item.label}
              aria-pressed={
                selectedTool === item.tool &&
                connectorRouting === item.routing &&
                lineEndArrow === item.endArrow
              }
              className="wb-toolbar-popover-item"
              key={item.id}
              onClick={() =>
                onSelect({
                  tool: item.tool,
                  routing: item.routing,
                  startArrow: item.startArrow,
                  endArrow: item.endArrow
                })
              }
              type="button"
            >
              <ConnectorIcon id={item.id} />
              <div className="wb-popover-item-text">
                <span className="wb-popover-item-title">{item.label}</span>
                <span className="wb-popover-item-desc">{item.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
};

export type { ToolbarMenuKind };
