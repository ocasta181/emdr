import type { Database } from "../../../src/main/internal/domain/app/types";
import { VaultTransfer } from "../../vault/components/VaultTransfer";
import { updateBilateralStimulationSettings } from "../service";
import { BilateralStimulationSettings } from "./BilateralStimulationSettings";

export function Settings({
  database,
  onChange,
  onExportEncryptedData,
  onImportEncryptedData
}: {
  database: Database;
  onChange: (database: Database) => void;
  onExportEncryptedData: () => Promise<string | undefined>;
  onImportEncryptedData: () => Promise<boolean>;
}) {
  return (
    <main className="screen">
      <section className="panel settingsPanel">
        <div className="panelHeader">
          <h1>Settings</h1>
        </div>
        <BilateralStimulationSettings
          settings={database.settings.bilateralStimulation}
          onChange={(settings) => onChange(updateBilateralStimulationSettings(database, settings))}
        />
        <VaultTransfer onExport={onExportEncryptedData} onImport={onImportEncryptedData} />
      </section>
    </main>
  );
}
