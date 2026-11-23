import { useId } from "react";

/** Subjective Units of Disturbance, 0–10. */
export const sudAnchors: [string, string] = ["No disturbance", "Worst imaginable"];
/** Validity of Cognition, 1–7. */
export const vocAnchors: [string, string] = ["Completely false", "Completely true"];

export function ScaleInput({
  label,
  min,
  max,
  value,
  anchors,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  value: number | undefined;
  anchors?: [string, string];
  onChange: (value: number | undefined) => void;
}) {
  const labelId = useId();
  const anchorsId = useId();
  const options = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div className="scaleField">
      <span className="scaleLabel" id={labelId}>
        {label}
      </span>
      <div
        className="scaleOptions"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={anchors ? anchorsId : undefined}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? "scaleOption selected" : "scaleOption"}
              // Clicking the selected value again clears it; these scores are optional.
              onClick={() => onChange(selected ? undefined : option)}
            >
              {option}
            </button>
          );
        })}
      </div>
      {anchors && (
        <div className="scaleAnchors" id={anchorsId}>
          <span>
            {min} · {anchors[0]}
          </span>
          <span>
            {max} · {anchors[1]}
          </span>
        </div>
      )}
    </div>
  );
}
