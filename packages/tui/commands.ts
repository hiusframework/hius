import type { Target } from "./target";

// The one registry both entry points from D16 read — the bottom input
// line (quick, exact) and the floating command palette (discoverable,
// fuzzy-searched). Neither owns command logic; both are just a different
// presentation over this.

export type CommandContext = {
  target: Target;
  switchEnvironment: (name: string) => void;
  environments: readonly string[];
};

export type Command = {
  id: string;
  label: string;
  description?: string;
  run: (ctx: CommandContext, args: string[]) => void | Promise<void>;
};

export type Plugin = {
  name: string;
  commands: Command[];
};

/**
 * Authoring helper for plugins — same fail-fast-on-typo role as
 * defineContract/defineModuleConfig, no behavior beyond validation. A
 * plugin declares commands; it never gets direct access to the TUI's
 * rendering internals, only the CommandContext a command's `run` receives.
 */
export function definePlugin(plugin: Plugin): Plugin {
  if (plugin.name.trim().length === 0) {
    throw new Error("[Hius/TUI] definePlugin: name must not be empty");
  }
  for (const command of plugin.commands) {
    if (command.id.trim().length === 0) {
      throw new Error(`[Hius/TUI] plugin "${plugin.name}": command id must not be empty`);
    }
  }
  return plugin;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      throw new Error(`[Hius/TUI] duplicate command id: "${command.id}"`);
    }
    this.commands.set(command.id, command);
  }

  registerPlugin(plugin: Plugin): void {
    for (const command of plugin.commands) {
      this.register({ ...command, id: `${plugin.name}:${command.id}` });
    }
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  /**
   * Substring match against id/label/description, case-insensitive — the
   * command palette's fuzzy search. Deliberately simple (no scoring/
   * ranking library) for v1; the palette is a short, human-curated list,
   * not a large corpus that needs real fuzzy ranking.
   */
  search(query: string): Command[] {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return this.list();
    return this.list().filter(
      (command) =>
        command.id.toLowerCase().includes(q) ||
        command.label.toLowerCase().includes(q) ||
        (command.description?.toLowerCase().includes(q) ?? false),
    );
  }
}

/** The commands every TUI session has regardless of plugins. */
export function registerBuiltinCommands(registry: CommandRegistry): void {
  registry.register({
    id: "server:start",
    label: "Start server",
    description: "Spawn the local dev server for the current environment",
    run: (ctx, args) => {
      if (args.length === 0) {
        throw new Error("server:start requires a command, e.g. server:start bun run index.ts");
      }
      ctx.target.start(args);
    },
  });

  registry.register({
    id: "server:stop",
    label: "Stop server",
    description: "Stop the running dev server for the current environment",
    run: (ctx) => ctx.target.stop(),
  });

  registry.register({
    id: "run",
    label: "Run command",
    description: "Run an arbitrary shell command against the current environment",
    run: async (ctx, args) => {
      if (args.length === 0) {
        throw new Error("run requires a command, e.g. run bun test");
      }
      await ctx.target.run(args);
    },
  });

  registry.register({
    id: "env",
    label: "Switch environment",
    description: "Switch the active tab/environment",
    run: (ctx, args) => {
      const [name] = args;
      if (!name) throw new Error("env requires a name, e.g. env test");
      ctx.switchEnvironment(name);
    },
  });
}
