import { useState } from "react";
import type { BilateralStimulationSettings } from "../../../shared/types";

export function SettingsPanel({
  settings,
  onChange,
  onExport,
  onImport,
  onLock
}: {
  settings: BilateralStimulationSettings;
  onChange: (patch: Partial<BilateralStimulationSettings>) => void;
  onExport: () => Promise<string | undefined>;
  onImport: () => Promise<boolean>;
  onLock: () => Promise<void>;
}) {
  const [transferMessage, setTransferMessage] = useState("");
  const dotColorLabels: Record<BilateralStimulationSettings["dotColor"], string> =
    settings.fieldMode === "light"
      ? {
          green: "Forest",
          blue: "Indigo",
          white: "Charcoal",
          orange: "Plum"
        }
      : {
          green: "Sage",
          blue: "Sky",
          white: "Pearl",
          orange: "Amber"
        };

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
      <h1>Ball Settings</h1>
      <label>
        Screen mode
        <select
          value={settings.fieldMode}
          onChange={(event) => onChange({ fieldMode: event.target.value as BilateralStimulationSettings["fieldMode"] })}
        >
          <option value="light">Light mode</option>
          <option value="dark">Dark mode</option>
        </select>
      </label>
      <label>
        Ball speed
        <input
          type="range"
          min="0.8"
          max="1.2"
          step="0.1"
          value={settings.speed}
          onChange={(event) => onChange({ speed: Number(event.target.value) })}
        />
      </label>
      <div className="speedReadout">{settings.speed.toFixed(1)} Hz</div>
      <label>
        Ball color
        <select
          value={settings.dotColor}
          onChange={(event) => onChange({ dotColor: event.target.value as BilateralStimulationSettings["dotColor"] })}
        >
          <option value="green">{dotColorLabels.green}</option>
          <option value="blue">{dotColorLabels.blue}</option>
          <option value="white">{dotColorLabels.white}</option>
          <option value="orange">{dotColorLabels.orange}</option>
        </select>
      </label>
      <label>
        Ball size
        <select
          value={settings.dotSize}
          onChange={(event) => onChange({ dotSize: event.target.value as BilateralStimulationSettings["dotSize"] })}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
      <h2>Encrypted Data</h2>
      <div className="buttonRow">
        <button onClick={() => void exportEncryptedData()}>Export</button>
        <button onClick={() => void importEncryptedData()}>Import</button>
        <button onClick={() => void onLock()}>Lock</button>
      </div>
      {transferMessage && <p className="authNotice">{transferMessage}</p>}
    </>
  );
}
