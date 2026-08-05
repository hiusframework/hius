import { defineCommand } from "citty";
import { consola } from "consola";
import { validateProject } from "hius";

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
      consola.success("validate: no boundary violations");
      return;
    }

    for (const violation of result.violations) {
      consola.error(violation.message);
    }

    // Throwing (rather than calling process.exit directly) keeps this
    // handler callable from a test without killing the test process —
    // runMain's own catch turns any thrown error into a non-zero exit.
    throw new Error(`${result.violations.length} boundary violation(s) found`);
  },
});
