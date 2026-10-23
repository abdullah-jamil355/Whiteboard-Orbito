import { MAX_STROKE_POINT_COUNT, MAX_TEXT_LENGTH, WHITEBOARD_PALETTE, type BoardObject, type ShapeKind } from "./board";
import { SHAPE_TYPES_SET, TEXT_ALIGNMENTS, assertAttributes, assertElement, fail, getAttribute, getChildElements, readArrowHead, readColor, readConnectorRouting, readCoordinate, readEndpoint, readGeometry, readIdentifier, readLineWeight, readNumber, assertTextOnly } from "./xml.validation.helpers";

export const parseObject = (element: Element, ids: readonly string[]): BoardObject => {
  const id = readIdentifier(getAttribute(element, "id"), "object ID");

  switch (element.localName) {
    case "shape": {
      assertElement(element, "shape");
      assertAttributes(element, ["id", "kind", "x", "y", "width", "height", "fill", "stroke", "lineWeight"], ["stickyNote"]);
      const stickyNote = element.hasAttribute("stickyNote") ? getAttribute(element, "stickyNote") : undefined;
      if (stickyNote !== undefined && stickyNote !== "true") fail("This file contains an invalid sticky note marker.");
      if (!SHAPE_TYPES_SET.has(getAttribute(element, "kind"))) fail("This file contains an unsupported shape type.");
      if (getChildElements(element).length > 0) fail("This shape contains unsupported content.");
      return {
        id,
        type: "shape",
        shape: getAttribute(element, "kind") as ShapeKind,
        geometry: readGeometry(element),
        style: {
          fill: readColor(getAttribute(element, "fill"), true),
          stroke: readColor(getAttribute(element, "stroke")),
          lineWeight: readLineWeight(getAttribute(element, "lineWeight"))
        },
        ...(stickyNote === "true" ? { stickyNote: true } : {})
      };
    }
    case "text": {
      assertElement(element, "text");
      assertAttributes(element, ["id", "x", "y", "width", "height", "alignment", "fontSize", "bold"], ["parentShapeId", "color", "italic", "underline", "autoFontSize"]);
      const alignment = getAttribute(element, "alignment");
      const bold = getAttribute(element, "bold");
      const italic = element.hasAttribute("italic") ? getAttribute(element, "italic") : undefined;
      const underline = element.hasAttribute("underline") ? getAttribute(element, "underline") : undefined;
      const autoFontSize = element.hasAttribute("autoFontSize") ? getAttribute(element, "autoFontSize") : undefined;
      const fontSize = readNumber(getAttribute(element, "fontSize"), "font size");
      const text = assertTextOnly(element);
      if (!TEXT_ALIGNMENTS.has(alignment)) fail("This file contains an unsupported text alignment.");
      if (bold !== "true" && bold !== "false") fail("This file contains an invalid text style.");
      if ([italic, underline, autoFontSize].some((value) => value !== undefined && value !== "true" && value !== "false")) fail("This file contains an invalid text style.");
      if (fontSize < 6 || fontSize > 256) fail("This file contains a font size outside the supported range.");
      if (text.length > MAX_TEXT_LENGTH) fail("This file contains text that is too long.");
      const parentShapeId = element.hasAttribute("parentShapeId")
        ? readIdentifier(getAttribute(element, "parentShapeId"), "shape reference")
        : undefined;
      return {
        id,
        type: "text",
        geometry: readGeometry(element),
        text,
        alignment: alignment as "left" | "center" | "right",
        fontSize,
        bold: bold === "true",
        ...(italic === "true" ? { italic: true } : {}),
        ...(underline === "true" ? { underline: true } : {}),
        color: readColor(element.hasAttribute("color") ? getAttribute(element, "color") : WHITEBOARD_PALETTE[0].value),
        ...(parentShapeId === undefined ? {} : { parentShapeId })
      };
    }
    case "stroke": {
      assertElement(element, "stroke");
      assertAttributes(element, ["id", "color", "lineWeight"]);
      const pointElements = getChildElements(element);
      if (pointElements.length === 0 || pointElements.length > MAX_STROKE_POINT_COUNT) {
        fail("This stroke has an unsupported number of points.");
      }
      const points = pointElements.map((point) => {
        assertElement(point, "point");
        assertAttributes(point, ["x", "y"]);
        if (getChildElements(point).length > 0) fail("This stroke point contains unsupported content.");
        return readCoordinate(point);
      });
      return {
        id,
        type: "stroke",
        points,
        color: readColor(getAttribute(element, "color")),
        lineWeight: readLineWeight(getAttribute(element, "lineWeight"))
      };
    }
    case "line":
    case "arrow": {
      assertElement(element, element.localName);
      assertAttributes(element, ["id", "color", "lineWeight"], ["startArrow", "endArrow", "routing"]);
      const children = getChildElements(element);
      const startEl = children.find((child) => child.localName === "start");
      const endEl = children.find((child) => child.localName === "end");
      if (startEl === undefined || endEl === undefined) return fail("This line is missing its endpoints.");
      const waypointEls = children.filter((child) => child.localName === "waypoint");
      if (children.length !== 2 + waypointEls.length) fail("This line contains unsupported content.");
      assertElement(startEl, "start");
      assertAttributes(startEl, ["x", "y"], ["shapeId", "connectionPoint"]);
      assertElement(endEl, "end");
      assertAttributes(endEl, ["x", "y"], ["shapeId", "connectionPoint"]);
      if (getChildElements(startEl).length > 0 || getChildElements(endEl).length > 0) {
        fail("This line endpoint contains unsupported content.");
      }
      const waypoints = waypointEls.map((waypointEl) => {
        assertElement(waypointEl, "waypoint");
        assertAttributes(waypointEl, ["x", "y"]);
        if (getChildElements(waypointEl).length > 0) fail("This line waypoint contains unsupported content.");
        return readCoordinate(waypointEl);
      });
      const start = readEndpoint(startEl, ids);
      const end = readEndpoint(endEl, ids);
      return {
        id,
        type: element.localName,
        start,
        end,
        color: readColor(getAttribute(element, "color")),
        lineWeight: readLineWeight(getAttribute(element, "lineWeight")),
        ...(waypoints.length > 0 ? { waypoints } : {}),
        ...(element.hasAttribute("startArrow") ? { startArrow: readArrowHead(getAttribute(element, "startArrow")) } : {}),
        ...(element.hasAttribute("endArrow") ? { endArrow: readArrowHead(getAttribute(element, "endArrow")) } : {}),
        ...(element.hasAttribute("routing") ? { routing: readConnectorRouting(getAttribute(element, "routing")) } : {})
      };
    }
    case "connector": {
      assertElement(element, "connector");
      assertAttributes(element, ["id", "color", "lineWeight"], ["startArrow", "endArrow", "routing"]);
      const children = getChildElements(element);
      const startEl = children.find((child) => child.localName === "start");
      const endEl = children.find((child) => child.localName === "end");
      if (startEl === undefined || endEl === undefined) return fail("This connector is missing its endpoints.");
      const waypointEls = children.filter((child) => child.localName === "waypoint");
      if (children.length !== 2 + waypointEls.length) fail("This connector contains unsupported content.");
      assertElement(startEl, "start");
      assertAttributes(startEl, ["x", "y"], ["shapeId", "connectionPoint"]);
      assertElement(endEl, "end");
      assertAttributes(endEl, ["x", "y"], ["shapeId", "connectionPoint"]);
      if (getChildElements(startEl).length > 0 || getChildElements(endEl).length > 0) {
        fail("This connector endpoint contains unsupported content.");
      }
      const waypoints = waypointEls.map((waypointEl) => {
        assertElement(waypointEl, "waypoint");
        assertAttributes(waypointEl, ["x", "y"]);
        if (getChildElements(waypointEl).length > 0) fail("This connector waypoint contains unsupported content.");
        return readCoordinate(waypointEl);
      });
      const color = readColor(getAttribute(element, "color"));
      const lineWeight = readLineWeight(getAttribute(element, "lineWeight"));
      return {
        id,
        type: "connector",
        start: readEndpoint(startEl, ids),
        end: readEndpoint(endEl, ids),
        color,
        lineWeight,
        ...(waypoints.length > 0 ? { waypoints } : {}),
        ...(element.hasAttribute("startArrow") ? { startArrow: readArrowHead(getAttribute(element, "startArrow")) } : {}),
        ...(element.hasAttribute("endArrow") ? { endArrow: readArrowHead(getAttribute(element, "endArrow")) } : {}),
        ...(element.hasAttribute("routing") ? { routing: readConnectorRouting(getAttribute(element, "routing")) } : {})
      };
    }
    default:
      return fail("This file contains an unsupported Whiteboard object.");
  }
};
