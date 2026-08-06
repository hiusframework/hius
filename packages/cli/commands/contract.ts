import { diffContracts } from "@hius/core";
import { defineCommand } from "citty";
import { consola } from "consola";
import { loadAllContracts } from "hius";

const diffCommand = defineCommand({
  meta: {
    name: "diff",
    description: "Classify contract changes between two domains/ directories as patch/minor/major",
  },
  args: {
    dir: {
      type: "string",
      description: "Path to the current domains/ directory",
      default: "domains",
    },
    against: {
      type: "string",
      description: "Path to the domains/ directory to compare against (a baseline checkout)",
      required: true,
    },
  },
  async run({ args }) {
    const [before, after] = await Promise.all([
      loadAllContracts(args.against),
      loadAllContracts(args.dir),
    ]);

    const result = diffContracts(before, after);

    if (result.changes.length === 0) {
      consola.success("contract diff: no changes");
      return;
    }

    for (const change of result.changes) {
      const log =
        change.severity === "major"
          ? consola.error
          : change.severity === "minor"
            ? consola.info
            : consola.success;
      log(`[${change.severity}] ${change.contractName}: ${change.message}`);
    }

    // Throwing (rather than calling process.exit directly) keeps this
    // handler callable from a test without killing the test process —
    // runMain's own catch turns any thrown error into a non-zero exit.
    // patch/minor changes are reported but don't fail the command — only
    // major (breaking) changes block a merge.
    if (result.severity === "major") {
      throw new Error(
        "contract diff: major (breaking) change(s) found — bump the contract's version",
      );
    }
  },
});

export const contractCommand = defineCommand({
  meta: {
    name: "contract",
    description: "Inspect and diff domain contracts",
  },
  subCommands: {
    diff: diffCommand,
  },
});
