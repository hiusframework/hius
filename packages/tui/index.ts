import { createCliRenderer } from "@opentui/core";
import { CommandRegistry, registerBuiltinCommands } from "./commands";
import { createTuiLayout } from "./layout";
import { createLocalTarget, type Target } from "./target";

export const PACKAGE_NAME = "@hius/tui" as const;

export type { Command, CommandContext, Plugin } from "./commands";
export { CommandRegistry, definePlugin, registerBuiltinCommands } from "./commands";
export type { LocalTargetOptions, LogLine, Target } from "./target";
export { createLocalTarget } from "./target";

export type RunTuiOptions = {
  /** Environment name → domains dir + optional DATABASE_URL. dev/test today (D16 v1 scope) — a RemoteTarget-backed entry is the same shape, added later without changing this signature. */
  environments: Record<string, { dir?: string; databaseUrl?: string }>;
  plugins?: import("./commands").Plugin[];
};

/**
 * The `hius tui` entry point — dynamically imported by @hius/cli so a
 * project that never runs `hius tui` never pays for @opentui/core (D16:
 * packages/tui is optional, not a hard dependency of packages/cli).
 */
export async function runTui(options: RunTuiOptions): Promise<void> {
  const environments = Object.keys(options.environments);
  if (environments.length === 0) {
    throw new Error("[Hius/TUI] runTui requires at least one environment");
  }

  const targets = new Map<string, Target>();
  const getTarget = (name: string): Target => {
    let target = targets.get(name);
    if (!target) {
      const config = options.environments[name];
      if (!config) throw new Error(`[Hius/TUI] unknown environment: ${name}`);
      target = createLocalTarget({ name, ...config });
      targets.set(name, target);
    }
    return target;
  };

  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  for (const plugin of options.plugins ?? []) registry.registerPlugin(plugin);

  const renderer = await createCliRenderer({
    exitOnCtrlC: true,
    onDestroy: () => {
      layout.dispose();
      for (const target of targets.values()) void target.dispose();
    },
  });
  const layout = createTuiLayout({ renderer, environments, getTarget, registry });

  renderer.start();
}
