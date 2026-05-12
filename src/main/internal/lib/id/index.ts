import { ulid } from "ulid";

export function createId(prefix: string) {
  if (!/^[a-z]{3}$/.test(prefix)) {
    throw new Error(`ID prefix must be exactly three lowercase letters: ${prefix}`);
  }
  return `${prefix}_${ulid()}`;
}
