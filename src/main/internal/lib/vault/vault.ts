import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import type { VaultFile, WrappedKey } from "./vault.types.js";

export type { VaultFile, WrappedKey } from "./vault.types.js";

const cipherName = "aes-256-gcm";
const keyBytes = 32;
const ivBytes = 12;
const saltBytes = 16;
const recoveryCodeBytes = 32;
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const vaultFormat = "emdr-local-vault";
const vaultVersion = 1;
const payloadType = "sqlite";

export function vaultPath(userDataPath: string) {
  return path.join(userDataPath, "emdr-local.vault");
}

export function vaultExists(userDataPath: string) {
  return existsSync(vaultPath(userDataPath));
}

export function encrypt(key: Buffer, plaintext: Buffer) {
  const iv = crypto.randomBytes(ivBytes);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    iv: toBase64Url(iv),
    tag: toBase64Url(cipher.getAuthTag()),
    ciphertext: toBase64Url(ciphertext)
  };
}

export function decrypt(key: Buffer, value: { iv: string; tag: string; ciphertext: string }) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, fromBase64Url(value.iv));
  decipher.setAuthTag(fromBase64Url(value.tag));
  return Buffer.concat([decipher.update(fromBase64Url(value.ciphertext)), decipher.final()]);
}

export function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyBytes, scryptOptions, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function generateDataKey() {
  return crypto.randomBytes(keyBytes);
}

export function generateSalt() {
  return crypto.randomBytes(saltBytes);
}

export function generateRecoveryCode() {
  return crypto.randomBytes(recoveryCodeBytes).toString("hex").toUpperCase();
}

export function parseRecoveryCode(recoveryCode: string) {
  const normalized = recoveryCode.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
  if (normalized.length !== recoveryCodeBytes * 2) {
    throw new Error("Recovery code must be 64 hexadecimal characters.");
  }
  return Buffer.from(normalized, "hex");
}

export async function readVaultFile(userDataPath: string): Promise<VaultFile> {
  return parseVaultContents(await readFile(vaultPath(userDataPath), "utf8"));
}

export async function writeVaultFile(userDataPath: string, vault: VaultFile) {
  await mkdir(userDataPath, { recursive: true });
  const target = vaultPath(userDataPath);
  const temporary = `${target}.tmp`;
  await writeFile(temporary, JSON.stringify(vault));
  await rename(temporary, target);
}

export function parseVaultContents(contents: string): VaultFile {
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

export function buildVaultFile(password: WrappedKey, recovery: WrappedKey, data: { iv: string; tag: string; ciphertext: string }): VaultFile {
  return {
    format: vaultFormat,
    version: vaultVersion,
    cipher: cipherName,
    kdf: { name: "scrypt", params: scryptOptions },
    password,
    recovery,
    data: { type: payloadType, ...data }
  };
}

function toBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function required(value: string | undefined) {
  if (!value) throw new Error("Vault is missing a required value.");
  return value;
}

export function unwrapPasswordKey(passwordKey: Buffer, wrapped: WrappedKey) {
  return decrypt(passwordKey, wrapped);
}

export function unwrapRecoveryKey(recoveryCode: string, wrapped: WrappedKey) {
  return decrypt(parseRecoveryCode(recoveryCode), wrapped);
}

export async function wrapWithPassword(dataKey: Buffer, password: string): Promise<WrappedKey> {
  const salt = generateSalt();
  return {
    salt: salt.toString("base64url"),
    ...encrypt(await derivePasswordKey(password, salt), dataKey)
  };
}

export function wrapWithRecoveryCode(dataKey: Buffer, recoveryCode: string): WrappedKey {
  return encrypt(parseRecoveryCode(recoveryCode), dataKey);
}

export async function derivePasswordKeyFromWrapped(password: string, wrapped: WrappedKey): Promise<Buffer> {
  const salt = Buffer.from(required(wrapped.salt), "base64url");
  return derivePasswordKey(password, salt);
}
