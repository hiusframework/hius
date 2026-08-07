#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { consoleCommand } from "./commands/console";
import { contractCommand } from "./commands/contract";
import { dbCommand } from "./commands/db";
import { generateCommand } from "./commands/generate";
import { tuiCommand } from "./commands/tui";
import { validateCommand } from "./commands/validate";

export const PACKAGE_NAME = "@hius/cli" as const;

export { consoleCommand } from "./commands/console";
export { contractCommand } from "./commands/contract";
export { dbCommand } from "./commands/db";
export { generateCommand } from "./commands/generate";
export { tuiCommand } from "./commands/tui";
export { validateCommand } from "./commands/validate";

const main = defineCommand({
  meta: {
    name: "hius",
    description: "Hius framework CLI",
  },
  subCommands: {
    validate: validateCommand,
    console: consoleCommand,
    contract: contractCommand,
    db: dbCommand,
    generate: generateCommand,
    tui: tuiCommand,
  },
});

if (import.meta.main) {
  runMain(main);
}
