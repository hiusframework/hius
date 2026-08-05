import { defineCommand } from "citty";
import { buildConsoleContext, startJsConsole } from "../console/js-console";

export const consoleCommand = defineCommand({
  meta: {
    name: "console",
    description: "REPL with full application context",
  },
  args: {
    dir: {
      type: "string",
      description: "Path to the apps/ directory",
      default: "apps",
    },
    app: {
      type: "string",
      description: "Scope the context to a single domain",
    },
  },
  async run({ args }) {
    const context = await buildConsoleContext(args.dir, args.app);
    const label = args.app ?? "hius";
    await startJsConsole(context, { prompt: (n) => `${label}:${n} > ` });
  },
});
