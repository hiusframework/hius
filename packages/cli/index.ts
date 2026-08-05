#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { consoleCommand } from "./commands/console";
import { dbCommand } from "./commands/db";
import { validateCommand } from "./commands/validate";

export const PACKAGE_NAME = "@hius/cli" as const;

export { consoleCommand } from "./commands/console";
export { dbCommand } from "./commands/db";
export { validateCommand } from "./commands/validate";

const main = defineCommand({
  meta: {
    name: "hius",
    description: "Hius framework CLI",
  },
  subCommands: {
    validate: validateCommand,
    console: consoleCommand,
    db: dbCommand,
  },
});

if (import.meta.main) {
  runMain(main);
}
