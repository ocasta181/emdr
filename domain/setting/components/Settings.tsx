import type { Database } from "../../app/types";
import { updateBilateralStimulationSettings } from "../service";
import { BilateralStimulationSettings } from "./BilateralStimulationSettings";

export function Settings({ database, onChange }: { database: Database; onChange: (database: Database) => void }) {
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
      </section>
    </main>
  );
}
