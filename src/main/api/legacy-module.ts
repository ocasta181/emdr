import { loadAppDatabase, saveAppDatabase } from "../internal/lib/store/sqlite/app-store.js";
import { VaultService } from "../../../domain/vault/service.js";
import type { MainModule } from "./modules.types.js";
import type { LegacyMainModuleOptions } from "./legacy-module.types.js";

export function createLegacyMainModule(options: LegacyMainModuleOptions): MainModule {
  const userDataPath = options.getUserDataPath;

  return {
    Name() {
      return "legacy-main";
    },

    Register(registry) {
      registry.handle("db:load", async () => {
        return loadAppDatabase(userDataPath());
      });

      registry.handle("db:save", async (database) => {
        await saveAppDatabase(userDataPath(), database as never);
        return { ok: true, path: new VaultService(userDataPath()).path() };
      });
    }
  };
}
