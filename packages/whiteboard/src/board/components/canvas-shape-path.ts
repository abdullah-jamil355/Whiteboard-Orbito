import type { ShapeKind } from "../board";

export type ShapeGeometry = Readonly<{ x: number; y: number; width: number; height: number }>;

const polygonPath = (points: readonly (readonly [number, number])[]): string =>
  `${points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`).join(" ")} Z`;

const regularPolygon = (geometry: ShapeGeometry, sides: number, inset = 1): readonly (readonly [number, number])[] => {
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;
  const radiusX = geometry.width / 2 * inset;
  const radiusY = geometry.height / 2 * inset;
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / sides;
    return [centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY] as const;
  });
};

export const shapePath = (shape: ShapeKind, geometry: ShapeGeometry): string => {
  const { x, y, width, height } = geometry;
  const right = x + width;
  const bottom = y + height;
  const middleX = x + width / 2;
  const middleY = y + height / 2;
  switch (shape) {
    case "rectangle": return `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`;
    case "rounded-rectangle": {
      const radius = Math.min(width, height, 24) * 0.16;
      return `M ${x + radius} ${y} H ${right - radius} Q ${right} ${y} ${right} ${y + radius} V ${bottom - radius} Q ${right} ${bottom} ${right - radius} ${bottom} H ${x + radius} Q ${x} ${bottom} ${x} ${bottom - radius} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
    }
    case "circle": {
      const radiusX = width / 2;
      const radiusY = height / 2;
      const control = 0.5522847498;
      return `M ${middleX} ${y} C ${middleX + radiusX * control} ${y} ${right} ${middleY - radiusY * control} ${right} ${middleY} C ${right} ${middleY + radiusY * control} ${middleX + radiusX * control} ${bottom} ${middleX} ${bottom} C ${middleX - radiusX * control} ${bottom} ${x} ${middleY + radiusY * control} ${x} ${middleY} C ${x} ${middleY - radiusY * control} ${middleX - radiusX * control} ${y} ${middleX} ${y} Z`;
    }
    case "diamond": return polygonPath([[middleX, y], [right, middleY], [middleX, bottom], [x, middleY]]);
    case "triangle": return polygonPath([[middleX, y], [right, bottom], [x, bottom]]);
    case "hexagon": return polygonPath([[x + width * 0.25, y], [x + width * 0.75, y], [right, middleY], [x + width * 0.75, bottom], [x + width * 0.25, bottom], [x, middleY]]);
    case "parallelogram": return polygonPath([[x + width * 0.22, y], [right, y], [x + width * 0.78, bottom], [x, bottom]]);
    case "trapezoid": return polygonPath([[x + width * 0.2, y], [x + width * 0.8, y], [right, bottom], [x, bottom]]);
    case "pentagon": return polygonPath(regularPolygon(geometry, 5));
    case "octagon": return polygonPath(regularPolygon(geometry, 8, 0.86));
    case "star": return polygonPath(Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = (index % 2 === 0 ? 0.5 : 0.22) * Math.min(width, height);
      return [middleX + Math.cos(angle) * radius, middleY + Math.sin(angle) * radius] as const;
    }));
    case "cross": return polygonPath([
      [x + width / 3, y], [x + width * 2 / 3, y], [x + width * 2 / 3, y + height / 3], [right, y + height / 3],
      [right, y + height * 2 / 3], [x + width * 2 / 3, y + height * 2 / 3], [x + width * 2 / 3, bottom],
      [x + width / 3, bottom], [x + width / 3, y + height * 2 / 3], [x, y + height * 2 / 3],
      [x, y + height / 3], [x + width / 3, y + height / 3]
    ]);
    case "cylinder": {
      const cap = height * 0.16;
      return `M ${x} ${y + cap} C ${x} ${y - cap * 0.25} ${right} ${y - cap * 0.25} ${right} ${y + cap} V ${bottom - cap} C ${right} ${bottom + cap * 0.25} ${x} ${bottom + cap * 0.25} ${x} ${bottom - cap} Z M ${x} ${y + cap} C ${x} ${y + cap * 2.25} ${right} ${y + cap * 2.25} ${right} ${y + cap} M ${x} ${bottom - cap} C ${x} ${bottom + cap * 1.25} ${right} ${bottom + cap * 1.25} ${right} ${bottom - cap}`;
    }
    case "cloud": return `M ${x + width * 0.22} ${y + height * 0.82} C ${x - width * 0.04} ${y + height * 0.82} ${x - width * 0.05} ${y + height * 0.5} ${x + width * 0.12} ${y + height * 0.42} C ${x + width * 0.07} ${y + height * 0.18} ${x + width * 0.35} ${y + height * 0.08} ${x + width * 0.48} ${y + height * 0.27} C ${x + width * 0.65} ${y - height * 0.02} ${x + width * 0.95} ${y + height * 0.19} ${x + width * 0.86} ${y + height * 0.42} C ${x + width * 1.12} ${y + height * 0.49} ${x + width * 1.03} ${y + height * 0.84} ${x + width * 0.78} ${y + height * 0.82} C ${x + width * 0.62} ${y + height * 1.03} ${x + width * 0.38} ${y + height * 1.03} ${x + width * 0.22} ${y + height * 0.82} Z`;
    case "document": return `M ${x} ${y} H ${right} V ${bottom - height * 0.14} Q ${x + width * 0.75} ${bottom - height * 0.3} ${middleX} ${bottom - height * 0.14} Q ${x + width * 0.25} ${bottom} ${x} ${bottom - height * 0.14} Z`;
    case "speech-bubble": return `M ${x} ${y} H ${right} V ${bottom - height * 0.22} H ${x + width * 0.38} L ${x + width * 0.2} ${bottom} V ${bottom - height * 0.22} H ${x} Z`;
    case "right-arrow": return polygonPath([[x, y + height * 0.28], [x + width * 0.58, y + height * 0.28], [x + width * 0.58, y], [right, middleY], [x + width * 0.58, bottom], [x + width * 0.58, y + height * 0.72], [x, y + height * 0.72]]);
    case "left-arrow": return polygonPath([[right, y + height * 0.28], [x + width * 0.42, y + height * 0.28], [x + width * 0.42, y], [x, middleY], [x + width * 0.42, bottom], [x + width * 0.42, y + height * 0.72], [right, y + height * 0.72]]);
    case "up-arrow": return polygonPath([[x + width * 0.28, bottom], [x + width * 0.28, y + height * 0.42], [x, y + height * 0.42], [middleX, y], [right, y + height * 0.42], [x + width * 0.72, y + height * 0.42], [x + width * 0.72, bottom]]);
    case "down-arrow": return polygonPath([[x + width * 0.28, y], [x + width * 0.72, y], [x + width * 0.72, y + height * 0.58], [right, y + height * 0.58], [middleX, bottom], [x, y + height * 0.58], [x + width * 0.28, y + height * 0.58]]);
    case "double-arrow": return polygonPath([[x, middleY], [x + width * 0.28, y], [x + width * 0.28, y + height * 0.28], [x + width * 0.72, y + height * 0.28], [x + width * 0.72, y], [right, middleY], [x + width * 0.72, bottom], [x + width * 0.72, y + height * 0.72], [x + width * 0.28, y + height * 0.72], [x + width * 0.28, bottom]]);
    case "left-right-arrow": return polygonPath([[x, middleY], [x + width * 0.22, y], [x + width * 0.22, y + height * 0.28], [x + width * 0.78, y + height * 0.28], [x + width * 0.78, y], [right, middleY], [x + width * 0.78, bottom], [x + width * 0.78, y + height * 0.72], [x + width * 0.22, y + height * 0.72], [x + width * 0.22, bottom]]);
  }
};
