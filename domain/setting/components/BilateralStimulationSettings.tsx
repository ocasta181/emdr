import type { BilateralStimulationSettings as BilateralStimulationSettingsType } from "../types";

export const ballColors: Record<BilateralStimulationSettingsType["dotColor"], string> = {
  green: "#8fbf8f",
  blue: "#8fb4d8",
  white: "#f2efe8",
  orange: "#d89b64"
};

export function BilateralStimulationSettings({
  settings,
  onChange,
  compact = false
}: {
  settings: BilateralStimulationSettingsType;
  onChange: (settings: BilateralStimulationSettingsType) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "settingsControls compact" : "settingsControls"}>
      <label>
        Speed
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={settings.speed}
          onChange={(event) => onChange({ ...settings, speed: Number(event.target.value) })}
        />
      </label>
      <div className="speedReadout">{settings.speed.toFixed(1)}x</div>
      <label>
        Ball color
        <select
          value={settings.dotColor}
          onChange={(event) =>
            onChange({
              ...settings,
              dotColor: event.target.value as BilateralStimulationSettingsType["dotColor"]
            })
          }
        >
          {Object.keys(ballColors).map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </label>
      <div className="colorSwatches" aria-hidden="true">
        {Object.entries(ballColors).map(([color, value]) => (
          <span
            className={settings.dotColor === color ? "colorSwatch active" : "colorSwatch"}
            key={color}
            style={{ backgroundColor: value }}
          />
        ))}
      </div>
    </div>
  );
}
