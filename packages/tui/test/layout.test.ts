import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer } from "@opentui/core/testing";
import { CommandRegistry, registerBuiltinCommands } from "@/commands";
import { createTuiLayout } from "@/layout";
import type { LogLine, Target } from "@/target";

// A stub, not createLocalTarget — these tests are about the layout's own
// wiring (tab switching, the palette, focus cycling), not about
// LocalTarget's behavior, which target.test.ts already covers against
// the real thing.
function stubTarget(name: string, onSubscribe?: () => void): Target {
  const logHandlers = new Set<(line: LogLine) => void>();
  return {
    name,
    isRunning: () => false,
    start: () => {},
    stop: () => {},
    run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    onLog: (handler) => {
      onSubscribe?.();
      logHandlers.add(handler);
      return () => logHandlers.delete(handler);
    },
    evalConsole: async (input) => ({ output: `console:${name}:${input}`, isError: false }),
    evalDb: async (input) => ({ output: `db:${name}:${input}`, isError: false }),
    dispose: async () => {},
  };
}

let teardown: (() => Promise<void>) | undefined;

afterEach(async () => {
  await teardown?.();
  teardown = undefined;
});

async function setup(environments = ["dev", "test"], onSubscribe?: (name: string) => void) {
  const { renderer, mockInput, renderOnce, captureCharFrame, waitFor } = await createTestRenderer({
    width: 100,
    height: 30,
  });
  teardown = async () => renderer.destroy();

  const targets = new Map<string, Target>(
    environments.map((name) => [name, stubTarget(name, () => onSubscribe?.(name))]),
  );
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);

  const layout = createTuiLayout({
    renderer,
    environments,
    getTarget: (name) => {
      const target = targets.get(name);
      if (!target) throw new Error(`no stub target for ${name}`);
      return target;
    },
    registry,
  });

  await renderOnce();
  return { renderer, mockInput, renderOnce, captureCharFrame, waitFor, layout, targets };
}

// A lone Escape byte (0x1B) is ambiguous with the start of a longer ANSI
// CSI sequence (arrow keys, etc.) — the real stdin parser holds it for a
// short window before deciding it's a standalone Escape. Real elapsed
// time, not an extra render pass, is what resolves that.
async function pressEscapeAndWait(
  mockInput: Awaited<ReturnType<typeof setup>>["mockInput"],
): Promise<void> {
  mockInput.pressEscape();
  await Bun.sleep(80);
}

describe("createTuiLayout", () => {
  test("renders the tab bar and all three panes", async () => {
    const { captureCharFrame } = await setup();
    const frame = captureCharFrame();

    expect(frame).toContain("dev");
    expect(frame).toContain("test");
    expect(frame).toContain("Console");
    expect(frame).toContain("DB");
    expect(frame).toContain("Logs");
  });

  test("shows the status bar hotkey hints", async () => {
    const { captureCharFrame } = await setup();
    expect(captureCharFrame()).toContain("Ctrl+K");
  });

  test("shows the always-visible quick input line", async () => {
    const { captureCharFrame } = await setup();
    expect(captureCharFrame()).toContain("command args");
  });

  test("Ctrl+K opens the command palette", async () => {
    const { mockInput, renderOnce, captureCharFrame } = await setup();

    mockInput.pressKey("k", { ctrl: true });
    await renderOnce();

    expect(captureCharFrame()).toContain("Commands");
  });

  test("Escape closes the command palette", async () => {
    const { mockInput, renderOnce, captureCharFrame } = await setup();

    mockInput.pressKey("k", { ctrl: true });
    await renderOnce();
    expect(captureCharFrame()).toContain("Commands");

    await pressEscapeAndWait(mockInput);
    await renderOnce();

    expect(captureCharFrame()).not.toContain("Commands");
  });

  test("the palette filters commands as the query changes", async () => {
    const { mockInput, renderOnce, captureCharFrame } = await setup();

    mockInput.pressKey("k", { ctrl: true });
    await renderOnce();
    expect(captureCharFrame()).toContain("Stop server");

    await mockInput.typeText("start");
    await renderOnce();

    const frame = captureCharFrame();
    expect(frame).toContain("Start server");
    expect(frame).not.toContain("Stop server");
  });

  test("Tab cycles focus through tab bar → console → db → quick input → tab bar", async () => {
    const { renderer, mockInput, renderOnce } = await setup();

    const consoleInput = renderer.root.findDescendantById("tui:console:input");
    const dbInput = renderer.root.findDescendantById("tui:db:input");
    const quickInput = renderer.root.findDescendantById("tui:quick-input");
    const tabBar = renderer.root.findDescendantById("tui:tabs");

    expect(tabBar?.focused).toBe(true);

    mockInput.pressTab();
    await renderOnce();
    expect(consoleInput?.focused).toBe(true);

    mockInput.pressTab();
    await renderOnce();
    expect(dbInput?.focused).toBe(true);

    mockInput.pressTab();
    await renderOnce();
    expect(quickInput?.focused).toBe(true);

    mockInput.pressTab();
    await renderOnce();
    expect(tabBar?.focused).toBe(true);
  });

  test("running a command from the quick input line switches environment", async () => {
    const subscribed: string[] = [];
    const { mockInput, renderOnce } = await setup(["dev", "staging"], (name) =>
      subscribed.push(name),
    );
    // attachTarget(dev) runs once during setup, before any key is pressed.
    expect(subscribed).toEqual(["dev"]);

    // Tab bar → console → db → quick input.
    mockInput.pressTab();
    mockInput.pressTab();
    mockInput.pressTab();
    await renderOnce();

    await mockInput.typeText("env staging");
    mockInput.pressEnter();
    await renderOnce();

    expect(subscribed).toEqual(["dev", "staging"]);
  });

  test("typing into the focused console pane evaluates against the current environment's target", async () => {
    const { mockInput, renderOnce, captureCharFrame, waitFor } = await setup();

    mockInput.pressTab();
    await renderOnce();
    await mockInput.typeText("1 + 1");
    mockInput.pressEnter();

    // onSubmit is async (evalConsole returns a Promise) — its appendLine
    // continuation lands after the keypress dispatch itself resolves, so
    // this waits for the result rather than assuming one more frame did it.
    await waitFor(() => captureCharFrame().includes("console:dev:1 + 1"));

    expect(captureCharFrame()).toContain("console:dev:1 + 1");
  });

  test("switching the environment tab re-attaches the console pane's target", async () => {
    const { mockInput, renderOnce, captureCharFrame, waitFor } = await setup(["dev", "staging"]);

    mockInput.pressArrow("right");
    await renderOnce();
    mockInput.pressEnter();
    await renderOnce();

    mockInput.pressTab();
    await renderOnce();
    await mockInput.typeText("1");
    mockInput.pressEnter();

    await waitFor(() => captureCharFrame().includes("console:staging:1"));

    expect(captureCharFrame()).toContain("console:staging:1");
  });
});
