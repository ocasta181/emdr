import { app } from "electron";
import { Start } from "../src/main/api/app.js";

void Start().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  app.exit(1);
});
