"use client";

import type { CSSProperties, ReactElement } from "react";
import { Button } from "@workspace/ui/primitives/button";
import { WHITEBOARD_PALETTE } from "..";

type PaletteChoicesProps = Readonly<{
  label: string;
  selectedColor: string;
  onChoose: (color: string) => void;
}>;

export const PaletteChoices = ({ label, selectedColor, onChoose }: PaletteChoicesProps): ReactElement => (
  <div className="wb-pen-colors" role="group" aria-label={label}>
    {WHITEBOARD_PALETTE.map((color) => (
      <Button
        aria-label={`${color.name} ${label.toLowerCase()}`}
        aria-pressed={selectedColor === color.value}
        className="wb-color-choice"
        key={color.value}
        onClick={() => onChoose(color.value)}
        size="icon"
        style={{ "--wb-pen-color": color.value } as CSSProperties}
        title={`${color.name} ${label.toLowerCase()}`}
        variant={selectedColor === color.value ? "secondary" : "ghost"}
      ><span aria-hidden="true" className="wb-color-swatch" /></Button>
    ))}
  </div>
);
