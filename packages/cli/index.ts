#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { consoleCommand } from "./commands/console";
import { validateCommand } from "./commands/validate";

export const PACKAGE_NAME = "@hius/cli" as const;

export { consoleCommand } from "./commands/console";
export { validateCommand } from "./commands/validate";

const main = defineCommand({
  meta: {
    name: "hius",
    description: "Hius framework CLI",
  },
  subCommands: {
    validate: validateCommand,
    console: consoleCommand,
  },
});

if (import.meta.main) {
  runMain(main);
}
