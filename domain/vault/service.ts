import { readFile, writeFile } from "node:fs/promises";
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
} from "../../core/internal/lib/vault.js";
import type { UnlockedVault } from "./types.js";

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

  async export(destinationPath: string) {
    const vault = await readVaultFile(this.userDataPath);
    await writeFile(destinationPath, JSON.stringify(vault, null, 2));
  }

  async import(sourcePath: string) {
    const vault = parseVaultContents(await readFile(sourcePath, "utf8"));
    await writeVaultFile(this.userDataPath, vault);
  }
}
