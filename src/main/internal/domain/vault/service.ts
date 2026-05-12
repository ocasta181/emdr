import type { VaultFileService } from "../../lib/vault/service.js";
import type { VaultStoreAccess } from "./types.js";

export class VaultService {
  constructor(
    private readonly vaultFiles: VaultFileService,
    private readonly store: VaultStoreAccess
  ) {}

  status() {
    if (this.store.isUnlocked()) return "unlocked" as const;
    return this.vaultFiles.exists() ? "locked" as const : "setupRequired" as const;
  }

  async create(password: string) {
    const plaintext = await this.store.createPlaintext();
    const { recoveryCode, dataKey } = await this.vaultFiles.create(password, plaintext);
    await this.store.unlock({ dataKey, plaintext });
    return { recoveryCode };
  }

  async unlockWithPassword(password: string) {
    await this.store.unlock(await this.vaultFiles.unlockWithPassword(password));
    return { ok: true } as const;
  }

  async unlockWithRecoveryCode(recoveryCode: string) {
    await this.store.unlock(await this.vaultFiles.unlockWithRecoveryCode(recoveryCode));
    return { ok: true } as const;
  }

  defaultExportName() {
    return this.vaultFiles.defaultExportName();
  }

  exportVault(destinationPath: string) {
    return this.vaultFiles.export(destinationPath);
  }

  async importVault(sourcePath: string) {
    await this.vaultFiles.import(sourcePath);
    this.store.lock();
  }
}
