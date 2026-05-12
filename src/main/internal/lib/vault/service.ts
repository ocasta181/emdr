import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
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
} from "./vault.js";
import type { VaultFile } from "./vault.types.js";

export class VaultFileService {
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

  async unlockWithPassword(password: string) {
    const vault = await readVaultFile(this.userDataPath);
    const passwordKey = await derivePasswordKeyFromWrapped(password, vault.password);
    const dataKey = decrypt(passwordKey, vault.password);
    return { dataKey, plaintext: decrypt(dataKey, vault.data) };
  }

  async unlockWithRecoveryCode(recoveryCode: string) {
    const vault = await readVaultFile(this.userDataPath);
    const dataKey = decrypt(parseRecoveryCode(recoveryCode), vault.recovery);
    return { dataKey, plaintext: decrypt(dataKey, vault.data) };
  }

  saveSync(dataKey: Buffer, plaintext: Buffer) {
    const vault = readVaultFileSync(this.userDataPath);
    writeVaultFileSync(this.userDataPath, { ...vault, data: { type: "sqlite" as const, ...encrypt(dataKey, plaintext) } });
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
