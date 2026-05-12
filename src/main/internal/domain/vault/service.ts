import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { VaultFileDialogs } from "../../lib/electron/vault-file-dialogs.types.js";
import {
  buildVaultFile,
  decrypt,
  derivePasswordKeyFromWrapped,
  encrypt,
  generateDataKey,
  generateRecoveryCode,
  parseRecoveryCode,
  parseVaultContents,
  readVaultFile,
  vaultExists,
  vaultPath,
  wrapWithPassword,
  wrapWithRecoveryCode,
  writeVaultFile
} from "../../lib/vault/vault.js";
import type { UnlockedVault, VaultStatus, VaultStorage } from "./types.js";
import type { VaultFile } from "../../lib/vault/vault.types.js";

export type { UnlockedVault, VaultStatus } from "./types.js";

export class VaultService {
  constructor(private readonly userDataPath: string) {}

  path() {
    return vaultPath(this.userDataPath);
  }

  exists() {
    return vaultExists(this.userDataPath);
  }

  defaultExportName(date = new Date()) {
    return `${date.toISOString().slice(0, 10)}-emdr-local.emdr-vault`;
  }

  async create(password: string, plaintext: Buffer) {
    const dataKey = generateDataKey();
    const recoveryCode = generateRecoveryCode();
    const vault = buildVaultFile(
      await wrapWithPassword(dataKey, password),
      wrapWithRecoveryCode(dataKey, recoveryCode),
      encrypt(dataKey, plaintext)
    );

    await writeVaultFile(this.userDataPath, vault);
    return { recoveryCode, dataKey };
  }

  async unlockWithPassword(password: string): Promise<UnlockedVault> {
    const vault = await readVaultFile(this.userDataPath);
    const passwordKey = await derivePasswordKeyFromWrapped(password, vault.password);
    const dataKey = decrypt(passwordKey, vault.password);
    return { dataKey, plaintext: decrypt(dataKey, vault.data) };
  }

  async unlockWithRecoveryCode(recoveryCode: string): Promise<UnlockedVault> {
    const vault = await readVaultFile(this.userDataPath);
    const dataKey = decrypt(parseRecoveryCode(recoveryCode), vault.recovery);
    return { dataKey, plaintext: decrypt(dataKey, vault.data) };
  }

  async save(dataKey: Buffer, plaintext: Buffer) {
    const vault = await readVaultFile(this.userDataPath);
    await writeVaultFile(this.userDataPath, { ...vault, data: { type: "sqlite" as const, ...encrypt(dataKey, plaintext) } });
  }

  saveSync(dataKey: Buffer, plaintext: Buffer) {
    const vault = readVaultFileSync(this.userDataPath);
    writeVaultFileSync(this.userDataPath, { ...vault, data: { type: "sqlite" as const, ...encrypt(dataKey, plaintext) } });
  }

  async exportVaultFile(destinationPath: string) {
    const vault = await readVaultFile(this.userDataPath);
    await writeFile(destinationPath, JSON.stringify(vault, null, 2));
  }

  async import(sourcePath: string) {
    const vault = parseVaultContents(await readFile(sourcePath, "utf8"));
    await writeVaultFile(this.userDataPath, vault);
  }
}

export class VaultApplicationService {
  constructor(
    private readonly vaultStorage: VaultStorage,
    private readonly vaultFiles: VaultService,
    private readonly vaultDialogs: VaultFileDialogs
  ) {}

  status() {
    return this.vaultStorage.status();
  }

  create(password: string) {
    return this.vaultStorage.create(password);
  }

  async unlockWithPassword(password: string) {
    await this.vaultStorage.unlockWithPassword(password);
    return { ok: true } as const;
  }

  async unlockWithRecoveryCode(recoveryCode: string) {
    await this.vaultStorage.unlockWithRecoveryCode(recoveryCode);
    return { ok: true } as const;
  }

  async exportVault() {
    const destinationPath = await this.vaultDialogs.chooseExportPath(this.vaultFiles.defaultExportName());
    if (!destinationPath) return { canceled: true } as const;

    await this.vaultFiles.exportVaultFile(destinationPath);
    return { canceled: false, path: destinationPath } as const;
  }

  async importVault() {
    const sourcePath = await this.vaultDialogs.chooseImportPath();
    if (!sourcePath) return { canceled: true };

    const confirmed = await this.vaultDialogs.confirmImportReplacement();
    if (!confirmed) return { canceled: true };

    await this.vaultFiles.import(sourcePath);
    this.vaultStorage.lock();
    return { canceled: false };
  }
}

function readVaultFileSync(userDataPath: string): VaultFile {
  return parseVaultContents(readFileSync(vaultPath(userDataPath), "utf8"));
}

function writeVaultFileSync(userDataPath: string, vault: VaultFile) {
  mkdirSync(userDataPath, { recursive: true });
  const target = vaultPath(userDataPath);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify(vault));
  renameSync(temporary, target);
}
