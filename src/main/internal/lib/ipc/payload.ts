export function recordFrom(value: unknown, label = "payload"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object.`);
  }
  return value as Record<string, unknown>;
}

export function requiredRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return recordFrom(value[key], key);
}

export function stringFrom(value: unknown, label = "payload"): string {
  if (typeof value !== "string") {
    throw new Error(`Expected ${label} to be a string.`);
  }
  return value;
}

export function requiredString(value: Record<string, unknown>, key: string): string {
  return stringFrom(value[key], key);
}

export function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field === "string") return field;
  throw new Error(`Expected ${key} to be a string.`);
}

export function requiredNumber(value: Record<string, unknown>, key: string): number {
  const field = value[key];
  if (typeof field !== "number" || !Number.isFinite(field)) {
    throw new Error(`Expected ${key} to be a finite number.`);
  }
  return field;
}

export function optionalNumber(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field === "number" && Number.isFinite(field)) return field;
  throw new Error(`Expected ${key} to be a finite number.`);
}

export function optionalNumberInRange(
  value: Record<string, unknown>,
  key: string,
  range: { min: number; max: number }
): number | undefined {
  const field = optionalNumber(value, key);
  if (field === undefined) return undefined;
  if (field < range.min || field > range.max) {
    throw new Error(`Expected ${key} to be between ${range.min} and ${range.max}.`);
  }
  return field;
}

export function requiredNumberInRange(
  value: Record<string, unknown>,
  key: string,
  range: { min: number; max: number }
): number {
  const field = requiredNumber(value, key);
  if (field < range.min || field > range.max) {
    throw new Error(`Expected ${key} to be between ${range.min} and ${range.max}.`);
  }
  return field;
}

export function optionalStringEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  label: string
): T | undefined {
  const field = value[key];
  if (field === undefined) return undefined;
  if (typeof field === "string" && allowed.includes(field as T)) {
    return field as T;
  }
  throw new Error(`Expected ${key} to be ${label}.`);
}

export function requiredStringEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  label: string
): T {
  const field = requiredString(value, key);
  if (allowed.includes(field as T)) {
    return field as T;
  }
  throw new Error(`Expected ${key} to be ${label}.`);
}
