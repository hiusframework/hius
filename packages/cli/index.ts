#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";
import { validateProject } from "hius";

export const PACKAGE_NAME = "@hius/cli" as const;

export const validateCommand = defineCommand({
  meta: {
    name: "validate",
    description: "Compare every domain's module.config against its extracted dependencies",
  },
  args: {
    dir: {
      type: "string",
      description: "Path to the apps/ directory",
      default: "apps",
    },
  },
  async run({ args }) {
    const result = await validateProject(args.dir);

    if (result.ok) {
      console.log("[Hius] validate: OK — no boundary violations");
      return;
    }

    // Throwing (rather than calling process.exit directly) keeps this
    // handler callable from a test without killing the test process —
    // runMain's own catch turns any thrown error into a non-zero exit.
    throw new Error(result.violations.map((v) => v.message).join("\n\n"));
  },
});

const main = defineCommand({
  meta: {
    name: "hius",
    description: "Hius framework CLI",
  },
  subCommands: {
    validate: validateCommand,
  },
});

if (import.meta.main) {
  runMain(main);
}
