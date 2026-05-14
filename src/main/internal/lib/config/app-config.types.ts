export type AppConfig = {
  sqliteTemplatePath: string;
  devServerUrl?: string;
  userDataPath?: string;
  useAnimatedUi: boolean;
  headless: boolean;
};

export type AppConfigDefaults = {
  sqliteTemplatePath: string;
};
