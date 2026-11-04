import type { ReactElement } from "react";
import { ChevronDown } from "lucide-react";

export type ToolbarSelectOption = Readonly<{ label: string; value: string }>;

type ToolbarSelectProps = Readonly<{
  "aria-label": string;
  className?: string;
  onChange: (value: string) => void;
  options: readonly ToolbarSelectOption[];
  value: string;
}>;

export const ToolbarSelect = ({
  "aria-label": label,
  className = "",
  onChange,
  options,
  value
}: ToolbarSelectProps): ReactElement => {
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <details className={`wb-toolbar-select ${className}`}>
      <summary aria-label={label} title={label}>
        <span>{selected?.label ?? value}</span><ChevronDown aria-hidden="true" />
      </summary>
      <div aria-label={label} className="wb-toolbar-select-menu" role="listbox">
        {options.map((option) => (
          <button
            aria-selected={option.value === value}
            className="wb-toolbar-select-option"
            key={option.value}
            onClick={(event) => {
              onChange(option.value);
              const details = event.currentTarget.closest("details");
              if (details) details.open = false;
            }}
            role="option"
            type="button"
          >{option.label}</button>
        ))}
      </div>
    </details>
  );
};
