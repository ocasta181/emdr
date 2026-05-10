import { ulid } from "ulid";

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix: string) {
  if (!/^[a-z]{3}$/.test(prefix)) {
    throw new Error(`ID prefix must be exactly three lowercase letters: ${prefix}`);
  }
  return `${prefix}_${ulid()}`;
}

export function replaceById<T extends { id: string }>(items: T[], item: T) {
  return items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : items.concat(item);
}

export function optionalNumber(value: string) {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
