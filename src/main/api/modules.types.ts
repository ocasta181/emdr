import type { ApiRegistry } from "./registry.types.js";

export type MainModule = {
  Name(): string;
  Register(registry: ApiRegistry): void;
};

export type InitializeOptions = {
  getUserDataPath: () => string;
};
