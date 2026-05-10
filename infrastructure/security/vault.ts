import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

const vaultVersion = 1;
const vaultFormat = "emdr-local-vault";
const cipherName = "aes-256-gcm";
const payloadType = "sqlite";
const keyBytes = 32;
const ivBytes = 12;
const saltBytes = 16;
const recoveryCodeBytes = 32;
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

type WrappedKey = {
  salt?: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

type VaultFile = {
  format: typeof vaultFormat;
  version: 1;
  cipher: typeof cipherName;
  kdf: {
    name: "scrypt";
    params: typeof scryptOptions;
  };
  password: WrappedKey;
  recovery: WrappedKey;
  data: {
    type: typeof payloadType;
    iv: string;
    tag: string;
    ciphertext: string;
  };
};

export type VaultStatus = "setupRequired" | "locked" | "unlocked";

export type UnlockedVault = {
  dataKey: Buffer;
  plaintext: Buffer;
};

export function vaultPath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.vault");
}

export function vaultExists(userDataPath: string) {
  return existsSync(vaultPath(userDataPath));
}

export async function createVault(userDataPath: string, password: string, plaintext: Buffer) {
  const dataKey = crypto.randomBytes(keyBytes);
  const recoveryCode = crypto.randomBytes(recoveryCodeBytes).toString("hex").toUpperCase();
  const vault: VaultFile = {
    format: vaultFormat,
    version: vaultVersion,
    cipher: cipherName,
    kdf: {
      name: "scrypt",
      params: scryptOptions
    },
    password: await wrapWithPassword(dataKey, password),
    recovery: wrapWithRecoveryCode(dataKey, recoveryCode),
    data: { type: payloadType, ...encrypt(dataKey, plaintext) }
  };

  await writeVault(userDataPath, vault);
  return { recoveryCode, dataKey };
}

export async function unlockVaultWithPassword(userDataPath: string, password: string): Promise<UnlockedVault> {
  const vault = await readVault(userDataPath);
  const dataKey = decrypt(await derivePasswordKey(password, fromBase64Url(required(vault.password.salt))), vault.password);
  return { dataKey, plaintext: decrypt(dataKey, vault.data) };
}

export async function unlockVaultWithRecoveryCode(userDataPath: string, recoveryCode: string): Promise<UnlockedVault> {
  const vault = await readVault(userDataPath);
  const dataKey = decrypt(parseRecoveryCode(recoveryCode), vault.recovery);
  return { dataKey, plaintext: decrypt(dataKey, vault.data) };
}

export async function saveVault(userDataPath: string, dataKey: Buffer, plaintext: Buffer) {
  const vault = await readVault(userDataPath);
  await writeVault(userDataPath, { ...vault, data: { type: payloadType, ...encrypt(dataKey, plaintext) } });
}

async function wrapWithPassword(dataKey: Buffer, password: string): Promise<WrappedKey> {
  const salt = crypto.randomBytes(saltBytes);
  return {
    salt: toBase64Url(salt),
    ...encrypt(await derivePasswordKey(password, salt), dataKey)
  };
}

function wrapWithRecoveryCode(dataKey: Buffer, recoveryCode: string): WrappedKey {
  return encrypt(parseRecoveryCode(recoveryCode), dataKey);
}

function encrypt(key: Buffer, plaintext: Buffer) {
  const iv = crypto.randomBytes(ivBytes);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: toBase64Url(iv),
    tag: toBase64Url(cipher.getAuthTag()),
    ciphertext: toBase64Url(ciphertext)
  };
}

function decrypt(key: Buffer, value: { iv: string; tag: string; ciphertext: string }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, fromBase64Url(value.iv));
  decipher.setAuthTag(fromBase64Url(value.tag));
  return Buffer.concat([decipher.update(fromBase64Url(value.ciphertext)), decipher.final()]);
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyBytes, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function parseRecoveryCode(recoveryCode: string) {
  const normalized = recoveryCode.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (normalized.length !== recoveryCodeBytes * 2) {
    throw new Error("Recovery code must be 64 hexadecimal characters.");
  }
  return Buffer.from(normalized, "hex");
}

async function readVault(userDataPath: string): Promise<VaultFile> {
  return parseVaultFile(await readFile(vaultPath(userDataPath), "utf8"));
}

async function writeVault(userDataPath: string, vault: VaultFile) {
  await mkdir(userDataPath, { recursive: true });
  const target = vaultPath(userDataPath);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(vault));
  await rename(temporary, target);
}

function parseVaultFile(contents: string): VaultFile {
  const vault = JSON.parse(contents) as Partial<VaultFile>;

  if (
    vault.format !== vaultFormat ||
    vault.version !== vaultVersion ||
    vault.cipher !== cipherName ||
    vault.kdf?.name !== "scrypt" ||
    vault.data?.type !== payloadType
  ) {
    throw new Error("Unsupported encrypted data file.");
  }

  return vault as VaultFile;
}

function required(value: string | undefined) {
  if (!value) throw new Error("Vault is missing a required value.");
  return value;
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}
