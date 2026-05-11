export type VaultFileDialogs = {
  chooseExportPath(defaultPath: string): Promise<string | undefined>;
  chooseImportPath(): Promise<string | undefined>;
  confirmImportReplacement(): Promise<boolean>;
};
