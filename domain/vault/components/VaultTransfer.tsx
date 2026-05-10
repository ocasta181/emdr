import { useState } from "react";

export function VaultTransfer({
  onExport,
  onImport
}: {
  onExport: () => Promise<string | undefined>;
  onImport: () => Promise<boolean>;
}) {
  const [message, setMessage] = useState("");

  async function exportEncryptedData() {
    const path = await onExport();
    setMessage(path ? `Exported encrypted data to ${path}` : "");
  }

  async function importEncryptedData() {
    const imported = await onImport();
    setMessage(imported ? "Imported encrypted data. Unlock to continue." : "");
  }

  return (
    <section className="vaultTransfer">
      <div>
        <h2>Encrypted Data</h2>
        <p className="subtle">Exports are encrypted vault files and require the password or recovery key to unlock.</p>
      </div>
      <div className="buttonRow">
        <button onClick={() => void exportEncryptedData()}>Export Encrypted Data</button>
        <button onClick={() => void importEncryptedData()}>Import Encrypted Data</button>
      </div>
      {message && <p className="actionNote">{message}</p>}
    </section>
  );
}
