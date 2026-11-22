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
  const [busy, setBusy] = useState(false);

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
      setBusy(true);
      await onCreate(password);
    } catch {
      setError("Could not create encrypted local data.");
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create password" lead="Your data is encrypted with this password and never leaves this Mac.">
      <form className="form" onSubmit={submit}>
        <label>
          Password
          <input
            autoFocus
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
              setError("");
            }}
          />
        </label>
        {error && (
          <div className="formError" role="alert">
            {error}
          </div>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Setting up…" : "Set up"}
        </button>
      </form>
      <div className="authFooter">
        <button type="button" className="quiet" onClick={() => void onImport()}>
          Import encrypted data
        </button>
      </div>
    </AuthShell>
  );
}

export function RecoveryCode({ recoveryCode, onContinue }: { recoveryCode: string; onContinue: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const formattedRecoveryCode = formatRecoveryCode(recoveryCode);

  async function copyRecoveryCode() {
    try {
      await navigator.clipboard.writeText(formattedRecoveryCode);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <AuthShell
      title="Recovery key"
      lead="This key unlocks your data if you forget the password. It is shown only once, so store it somewhere safe."
    >
      <div className="form">
        <div className="recoveryCodeBox">
          <code className="recoveryCode" aria-label="Recovery key">
            {formattedRecoveryCode}
          </code>
          <button type="button" className="quiet" onClick={() => void copyRecoveryCode()}>
            {copied === "copied" ? "Copied" : "Copy"}
          </button>
        </div>
        {copied === "failed" && <p className="authNotice">Select the key and copy it manually.</p>}
        <label className="confirmationLabel">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I saved this recovery key.</span>
        </label>
        {confirmed && (
          <button type="button" className="primary" onClick={() => void onContinue()}>
            Continue
          </button>
        )}
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
  const [mode, setMode] = useState<"password" | "recovery">("password");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setBusy(true);
      if (mode === "password") {
        await onUnlock(password);
      } else {
        await onRecoveryUnlock(recoveryCode);
      }
    } catch {
      setError(mode === "password" ? "That password did not unlock your data." : "That recovery key did not unlock your data.");
      setBusy(false);
    }
  }

  function switchMode(next: "password" | "recovery") {
    setMode(next);
    setError("");
  }

  return (
    <AuthShell title="Unlock" lead={notice}>
      <form className="form" onSubmit={unlock}>
        {mode === "password" ? (
          <label>
            Password
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
            />
          </label>
        ) : (
          <label>
            Recovery key
            <textarea
              autoFocus
              className="recoveryInput"
              rows={3}
              spellCheck={false}
              value={recoveryCode}
              onChange={(event) => {
                setRecoveryCode(event.target.value);
                setError("");
              }}
            />
          </label>
        )}
        {error && (
          <div className="formError" role="alert">
            {error}
          </div>
        )}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Unlocking…" : mode === "password" ? "Unlock" : "Unlock With Recovery key"}
        </button>
      </form>
      <div className="authFooter">
        <button
          type="button"
          className="quiet"
          onClick={() => switchMode(mode === "password" ? "recovery" : "password")}
        >
          {mode === "password" ? "Use recovery key" : "Use password"}
        </button>
        <button type="button" className="quiet" onClick={() => void onImport()}>
          Import encrypted data
        </button>
      </div>
    </AuthShell>
  );
}

function AuthShell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <main className="authScreen">
      <section className="panel authPanel">
        <header className="authHeader">
          <div className="authBrand">EMDR Local</div>
          <h1>{title}</h1>
          {lead && <p className="authNotice">{lead}</p>}
        </header>
        {children}
      </section>
    </main>
  );
}

function formatRecoveryCode(recoveryCode: string) {
  return recoveryCode.match(/.{1,8}/g)?.join("-") ?? recoveryCode;
}
