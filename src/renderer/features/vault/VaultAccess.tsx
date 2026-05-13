import { useState, type FormEvent, type ReactNode } from "react";

export function VaultSetup({
  onCreate,
  onImport
}: {
  onCreate: (password: string) => Promise<void>;
  onImport: () => Promise<boolean>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password) {
      setError("Enter a password.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setError("");
      await onCreate(password);
    } catch {
      setError("Could not create encrypted local data.");
    }
  }

  return (
    <AuthShell title="Create Password">
      <form className="form" onSubmit={submit}>
        <label>
          Password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Confirm password
          <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        </label>
        {error && <div className="formError">{error}</div>}
        <button type="submit">Set Up</button>
      </form>
      <div className="form recoveryUnlock">
        <button onClick={() => void onImport()}>Import Encrypted Data</button>
      </div>
    </AuthShell>
  );
}

export function RecoveryCode({ recoveryCode, onContinue }: { recoveryCode: string; onContinue: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const formattedRecoveryCode = formatRecoveryCode(recoveryCode);

  async function copyRecoveryCode() {
    try {
      await navigator.clipboard.writeText(formattedRecoveryCode);
      setCopyMessage("Recovery key copied.");
    } catch {
      setCopyMessage("Select and copy the recovery key manually.");
    }
  }

  return (
    <AuthShell title="Recovery Key">
      <div className="form">
        <p className="authNotice">
          Store this recovery key somewhere safe. It can unlock encrypted local data if the password is unavailable,
          and it is shown only during setup.
        </p>
        <label>
          Recovery key
          <textarea className="recoveryCode" readOnly spellCheck={false} value={formattedRecoveryCode} />
        </label>
        <div className="buttonRow">
          <button type="button" onClick={() => void copyRecoveryCode()}>
            Copy
          </button>
          {confirmed && (
            <button type="button" onClick={() => void onContinue()}>
              Continue
            </button>
          )}
        </div>
        <label className="confirmationLabel">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>I saved this recovery key.</span>
        </label>
        {copyMessage && <p className="authNotice">{copyMessage}</p>}
      </div>
    </AuthShell>
  );
}

export function VaultUnlock({
  onUnlock,
  onRecoveryUnlock,
  onImport,
  notice
}: {
  onUnlock: (password: string) => Promise<void>;
  onRecoveryUnlock: (recoveryCode: string) => Promise<void>;
  onImport: () => Promise<boolean>;
  notice?: string;
}) {
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");

  async function unlockWithCredential(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      await onUnlock(password);
    } catch {
      setError("Could not unlock encrypted local data.");
    }
  }

  async function unlockWithRecovery() {
    try {
      setError("");
      await onRecoveryUnlock(recoveryCode);
    } catch {
      setError("Could not unlock with recovery key.");
    }
  }

  return (
    <AuthShell title="Unlock">
      {notice && <p className="authNotice">{notice}</p>}
      <form className="form" onSubmit={unlockWithCredential}>
        <label>
          Password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit">Unlock</button>
      </form>
      <div className="form recoveryUnlock">
        <label>
          Recovery key
          <textarea
            spellCheck={false}
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value)}
          />
        </label>
        <button onClick={unlockWithRecovery}>Unlock With Recovery Key</button>
      </div>
      <div className="form recoveryUnlock">
        <button onClick={() => void onImport()}>Import Encrypted Data</button>
      </div>
      {error && <div className="formError">{error}</div>}
    </AuthShell>
  );
}

function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="authScreen">
      <section className="panel authPanel">
        <div className="panelHeader">
          <div>
            <div className="brand">EMDR Local</div>
            <h1>{title}</h1>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

function formatRecoveryCode(recoveryCode: string) {
  return recoveryCode.match(/.{1,8}/g)?.join("-") ?? recoveryCode;
}
