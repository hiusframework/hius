import {
  BoxRenderable,
  type CliRenderer,
  InputRenderable,
  InputRenderableEvents,
  type SelectOption,
  SelectRenderable,
  SelectRenderableEvents,
  TabSelectRenderable,
  TabSelectRenderableEvents,
  TextRenderable,
} from "@opentui/core";
import type { Command, CommandContext, CommandRegistry } from "./commands";
import { createEvalPane } from "./panes/eval-pane";
import { createLogsPane } from "./panes/logs-pane";
import type { Target } from "./target";

export type TuiLayoutOptions = {
  renderer: CliRenderer;
  environments: readonly string[];
  getTarget: (name: string) => Target;
  registry: CommandRegistry;
};

export type TuiLayout = {
  /** Torn down on exit — stops the current target's log subscription. */
  dispose: () => void;
};

const STATUS_HINTS =
  "Tab: switch pane · ←/→: switch environment (tab bar focused) · Ctrl+K: commands · Ctrl+C: quit";

/**
 * Assembles the shell: a tab bar (one tab per environment, D16) above a
 * row of three panes (console/db/logs), a status bar showing contextual
 * hotkeys, and two command-entry surfaces — a toggleable bottom input
 * line and a floating command palette — over the one CommandRegistry.
 * Zellij-style, not tmux/k9s-style, per the layout decision in D16.
 */
export function createTuiLayout(options: TuiLayoutOptions): TuiLayout {
  const { renderer, environments, getTarget, registry } = options;
  const ctx = renderer;

  renderer.root.flexDirection = "column";

  // --- tab bar: environments ---
  const tabBar = new TabSelectRenderable(ctx, {
    id: "tui:tabs",
    options: environments.map((name) => ({ name, description: "" })),
  });
  renderer.root.add(tabBar);

  // --- main pane row ---
  const paneRow = new BoxRenderable(ctx, {
    id: "tui:panes",
    flexGrow: 1,
    flexDirection: "row",
  });
  renderer.root.add(paneRow);

  let currentTarget = getTarget(environments[0] ?? "dev");
  let unsubscribeLogs: (() => void) | undefined;

  const consolePane = createEvalPane(ctx, {
    id: "tui:console",
    title: "Console",
    onSubmit: (input) => currentTarget.evalConsole(input),
  });
  const dbPane = createEvalPane(ctx, {
    id: "tui:db",
    title: "DB",
    onSubmit: (input) => currentTarget.evalDb(input),
  });
  const logsPane = createLogsPane(ctx, "tui:logs", "Logs");

  paneRow.add(consolePane.box);
  paneRow.add(dbPane.box);
  paneRow.add(logsPane.box);

  function attachTarget(target: Target): void {
    unsubscribeLogs?.();
    currentTarget = target;
    logsPane.clear();
    unsubscribeLogs = target.onLog((line) => logsPane.appendLine(line));
  }
  attachTarget(currentTarget);

  tabBar.on(TabSelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    attachTarget(getTarget(option.name));
  });

  // --- status bar ---
  const statusBar = new TextRenderable(ctx, {
    id: "tui:status",
    content: STATUS_HINTS,
    fg: "#808080",
    height: 1,
  });
  renderer.root.add(statusBar);

  // --- quick input line ---
  // Always part of the layout — no toggle key. Ctrl+J (linefeed, 0x0A) and
  // Ctrl+M (return, 0x0D) are indistinguishable from newline/enter at the
  // raw-byte level in a plain (non-Kitty-keyboard) terminal, which ruled
  // out a dedicated toggle chord for this; always-visible, reached by Tab
  // like any other pane, is also the closer match to the Claude Code input
  // bar this was modeled on — that one isn't toggled either.
  const quickInput = new InputRenderable(ctx, {
    id: "tui:quick-input",
    placeholder: "command args… (Enter to run)",
  });
  renderer.root.add(quickInput);

  function commandContext(): CommandContext {
    return {
      target: currentTarget,
      environments,
      switchEnvironment: (name) => attachTarget(getTarget(name)),
    };
  }

  async function runCommandLine(line: string): Promise<void> {
    const [id, ...args] = line.trim().split(/\s+/);
    if (!id) return;
    const command =
      registry.get(id) ?? registry.list().find((c) => c.label.toLowerCase() === id.toLowerCase());
    if (!command) {
      logsPane.appendLine({ stream: "info", text: `unknown command: ${id}`, at: new Date() });
      return;
    }
    try {
      await command.run(commandContext(), args);
    } catch (error) {
      logsPane.appendLine({
        stream: "stderr",
        text: error instanceof Error ? error.message : String(error),
        at: new Date(),
      });
    }
  }

  quickInput.on(InputRenderableEvents.ENTER, async (value: string) => {
    quickInput.value = "";
    await runCommandLine(value);
  });

  // --- command palette (floating overlay) ---
  const palette = new BoxRenderable(ctx, {
    id: "tui:palette",
    position: "absolute",
    top: 3,
    left: "10%",
    width: "80%",
    height: "60%",
    border: true,
    title: "Commands",
    visible: false,
    zIndex: 100,
  });
  const paletteInput = new InputRenderable(ctx, {
    id: "tui:palette-input",
    placeholder: "type to filter…",
  });
  const paletteList = new SelectRenderable(ctx, {
    id: "tui:palette-list",
    flexGrow: 1,
    options: [],
  });
  palette.add(paletteInput);
  palette.add(paletteList);
  renderer.root.add(palette);

  function commandsToOptions(commands: Command[]): SelectOption[] {
    return commands.map((c) => ({
      name: c.label,
      description: c.description ?? c.id,
      value: c.id,
    }));
  }

  function openPalette(): void {
    paletteList.options = commandsToOptions(registry.list());
    palette.visible = true;
    paletteInput.value = "";
    paletteInput.focus();
  }

  function closePalette(): void {
    palette.visible = false;
    tabBar.focus();
  }

  paletteInput.on(InputRenderableEvents.INPUT, (value: string) => {
    paletteList.options = commandsToOptions(registry.search(value));
  });

  paletteInput.on(InputRenderableEvents.ENTER, () => {
    paletteList.selectCurrent();
  });

  paletteList.on(
    SelectRenderableEvents.ITEM_SELECTED,
    async (_index: number, option: SelectOption) => {
      closePalette();
      const command = registry.get(option.value as string);
      if (!command) return;
      try {
        await command.run(commandContext(), []);
      } catch (error) {
        logsPane.appendLine({
          stream: "stderr",
          text: error instanceof Error ? error.message : String(error),
          at: new Date(),
        });
      }
    },
  );

  // --- Tab: cycle focus between the panes' inputs ---
  const focusRing = [tabBar, consolePane.input, dbPane.input, quickInput];
  function focusNext(): void {
    const current = focusRing.findIndex((r) => r.focused);
    const next = focusRing[(current + 1) % focusRing.length];
    next?.focus();
  }

  // --- global hotkeys ---
  // renderer.keyInput fires before dispatch to the focused renderable
  // (see @opentui/core's InternalKeyHandler doc comment) — stopping
  // propagation here for exactly the chords below is what keeps every
  // other keystroke (including plain letters while an eval pane's input
  // is focused) flowing to the focused widget unmodified.
  renderer.keyInput.on("keypress", (event) => {
    if (palette.visible && event.name === "escape") {
      closePalette();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!palette.visible && event.ctrl && event.name === "k") {
      openPalette();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!palette.visible && event.name === "tab") {
      focusNext();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  tabBar.focus();

  return {
    dispose: () => unsubscribeLogs?.(),
  };
}
