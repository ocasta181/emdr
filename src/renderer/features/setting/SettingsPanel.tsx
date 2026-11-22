import { useState } from "react";
import type { CSSProperties } from "react";
import type { BilateralStimulationSettings } from "../../../shared/types";
import { orbAngularSpeed, orbDiameter, stimulationColorHex, stimulationColors } from "../../animation/stimulationStyle";

// The preview strip is narrower than the room, so the dot is drawn at a third of its room size.
const previewScale = 0.32;

const dotSizes: Array<{ value: BilateralStimulationSettings["dotSize"]; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
];

export function SettingsPanel({
  settings,
  onChange,
  onExport,
  onImport,
  onLock,
  showPreview
}: {
  settings: BilateralStimulationSettings;
  onChange: (patch: Partial<BilateralStimulationSettings>) => void;
  onExport: () => Promise<string | undefined>;
  onImport: () => Promise<boolean>;
  onLock: () => Promise<void>;
  showPreview: boolean;
}) {
  const [transferMessage, setTransferMessage] = useState("");

  async function exportEncryptedData() {
    const exportPath = await onExport();
    setTransferMessage(exportPath ? `Exported encrypted data to ${exportPath}.` : "Export canceled.");
  }

  async function importEncryptedData() {
    const imported = await onImport();
    if (!imported) {
      setTransferMessage("Import canceled.");
    }
  }

  return (
    <>
      <section className="settingsSection">
        <h2>Bilateral stimulation</h2>
        {showPreview && <StimulationPreview settings={settings} />}
        <label>
          <span className="fieldRow">
            Speed <output className="speedReadout">{settings.speed.toFixed(1)}x</output>
          </span>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={settings.speed}
            onChange={(event) => onChange({ speed: Number(event.target.value) })}
          />
        </label>
        <div className="fieldGroup">
          <span className="scaleLabel" id="dot-color-label">
            Color
          </span>
          <div className="swatchRow" role="radiogroup" aria-labelledby="dot-color-label">
            {stimulationColors.map((color) => (
              <button
                key={color.value}
                type="button"
                role="radio"
                aria-checked={settings.dotColor === color.value}
                aria-label={color.label}
                title={color.label}
                className={settings.dotColor === color.value ? "swatch selected" : "swatch"}
                style={{ color: color.hex }}
                onClick={() => onChange({ dotColor: color.value })}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="fieldGroup">
          <span className="scaleLabel" id="dot-size-label">
            Size
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="dot-size-label">
            {dotSizes.map((size) => (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={settings.dotSize === size.value}
                className={settings.dotSize === size.value ? "selected" : undefined}
                onClick={() => onChange({ dotSize: size.value })}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="settingsSection">
        <h2>Encrypted data</h2>
        <div className="buttonRow">
          <button onClick={() => void exportEncryptedData()}>Export</button>
          <button onClick={() => void importEncryptedData()}>Import</button>
          <button onClick={() => void onLock()}>Lock</button>
        </div>
        {transferMessage && <p className="authNotice">{transferMessage}</p>}
      </section>
    </>
  );
}

function StimulationPreview({ settings }: { settings: BilateralStimulationSettings }) {
  // Matches the room orb: half a cycle (one sweep) takes π / angular speed seconds.
  const sweepSeconds = Math.PI / (orbAngularSpeed * settings.speed);
  const style = {
    "--preview-dot": `${Math.round(orbDiameter[settings.dotSize] * previewScale)}px`,
    "--preview-color": stimulationColorHex(settings.dotColor),
    "--preview-sweep": `${sweepSeconds.toFixed(3)}s`
  } as CSSProperties;
  return (
    <div className="stimulationPreview" style={style} aria-hidden="true">
      <span />
    </div>
  );
}
