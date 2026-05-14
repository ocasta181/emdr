import { existsSync } from "node:fs";
import path from "node:path";
import type { AppConfig, AppConfigDefaults } from "./app-config.types.js";

export type { AppConfig, AppConfigDefaults } from "./app-config.types.js";

export class ConfigError extends Error {
  constructor(readonly messages: string[]) {
    super(["Invalid app configuration.", ...messages].join("\n"));
    this.name = "ConfigError";
  }
}

export function loadAppConfig(
  env: NodeJS.ProcessEnv,
  argv: readonly string[] = process.argv,
  defaults: AppConfigDefaults
): AppConfig {
  return {
    sqliteTemplatePath: requiredExistingFile(
      env.EMDR_SQLITE_TEMPLATE_PATH ?? defaults.sqliteTemplatePath,
      "EMDR_SQLITE_TEMPLATE_PATH"
    ),
    devServerUrl: optionalNonEmpty(env.VITE_DEV_SERVER_URL),
    userDataPath: optionalNonEmpty(env.EMDR_LOCAL_USER_DATA_PATH),
    useAnimatedUi: argv.includes("--animated-ui") || env.EMDR_LOCAL_UI === "animated",
    headless: env.EMDR_QA_HEADLESS === "1"
  };
}

function requiredExistingFile(value: string | undefined, name: string) {
  const resolved = optionalNonEmpty(value);
  if (!resolved) {
    throw new ConfigError([`Missing required configuration: ${name}.`]);
  }

  const filePath = path.resolve(resolved);
  if (!existsSync(filePath)) {
    throw new ConfigError([`${name} must point to an existing file: ${filePath}.`]);
  }

  return filePath;
}

function optionalNonEmpty(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
