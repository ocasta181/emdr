export type VaultDialogs = {
  chooseExportPath(defaultPath: string): Promise<string | undefined>;
  chooseImportPath(): Promise<string | undefined>;
  confirmImportReplacement(): Promise<boolean>;
};

export type LegacyMainModuleOptions = {
  getUserDataPath: () => string;
  vaultDialogs: VaultDialogs;
};
