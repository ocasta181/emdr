import type { MainModule, InitializeOptions } from "./modules.types.js";
import { createLegacyMainModule } from "./legacy-module.js";
import { createVaultFileDialogs } from "../internal/lib/electron/vault-file-dialogs.js";

export async function Initialize(options: InitializeOptions): Promise<MainModule[]> {
  return [
    createLegacyMainModule({
      getUserDataPath: options.getUserDataPath,
      vaultDialogs: createVaultFileDialogs()
    })
  ];
}
