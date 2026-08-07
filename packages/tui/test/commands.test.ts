import { describe, expect, test } from "bun:test";
import {
  type CommandContext,
  CommandRegistry,
  definePlugin,
  registerBuiltinCommands,
} from "@/commands";
import { createLocalTarget } from "@/target";

function fakeContext(): CommandContext {
  return {
    target: createLocalTarget({ name: "test", dir: "domains" }),
    environments: ["dev", "test"],
    switchEnvironment: () => {},
  };
}

describe("definePlugin", () => {
  test("rejects an empty plugin name", () => {
    expect(() => definePlugin({ name: "", commands: [] })).toThrow("name must not be empty");
  });

  test("rejects a command with an empty id", () => {
    expect(() =>
      definePlugin({ name: "demo", commands: [{ id: "", label: "x", run: () => {} }] }),
    ).toThrow("command id must not be empty");
  });

  test("returns the plugin unchanged when valid", () => {
    const plugin = definePlugin({
      name: "demo",
      commands: [{ id: "hello", label: "Hello", run: () => {} }],
    });
    expect(plugin.name).toBe("demo");
    expect(plugin.commands).toHaveLength(1);
  });
});

describe("CommandRegistry", () => {
  test("registers and finds a command by id", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "noop", label: "No-op", run: () => {} });
    expect(registry.get("noop")?.label).toBe("No-op");
  });

  test("rejects a duplicate command id", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "noop", label: "No-op", run: () => {} });
    expect(() => registry.register({ id: "noop", label: "Again", run: () => {} })).toThrow(
      "duplicate command id",
    );
  });

  test("registerPlugin namespaces command ids under the plugin name", () => {
    const registry = new CommandRegistry();
    registry.registerPlugin(
      definePlugin({ name: "demo", commands: [{ id: "hello", label: "Hello", run: () => {} }] }),
    );
    expect(registry.get("demo:hello")).toBeDefined();
    expect(registry.get("hello")).toBeUndefined();
  });

  test("search matches id, label, and description case-insensitively", () => {
    const registry = new CommandRegistry();
    registry.register({
      id: "server:start",
      label: "Start server",
      description: "Spawn it",
      run: () => {},
    });
    registry.register({
      id: "server:stop",
      label: "Stop server",
      description: "Kill it",
      run: () => {},
    });

    expect(registry.search("START").map((c) => c.id)).toEqual(["server:start"]);
    expect(
      registry
        .search("server")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["server:start", "server:stop"]);
    expect(registry.search("kill").map((c) => c.id)).toEqual(["server:stop"]);
  });

  test("search with an empty query returns every command", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "a", label: "A", run: () => {} });
    registry.register({ id: "b", label: "B", run: () => {} });
    expect(
      registry
        .search("")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });
});

describe("registerBuiltinCommands", () => {
  test("registers server:start, server:stop, run, and env", () => {
    const registry = new CommandRegistry();
    registerBuiltinCommands(registry);
    expect(registry.get("server:start")).toBeDefined();
    expect(registry.get("server:stop")).toBeDefined();
    expect(registry.get("run")).toBeDefined();
    expect(registry.get("env")).toBeDefined();
  });

  test("server:start without a command throws a clear error", () => {
    const registry = new CommandRegistry();
    registerBuiltinCommands(registry);
    const command = registry.get("server:start");
    expect(() => command?.run(fakeContext(), [])).toThrow("requires a command");
  });

  test("env without a name throws a clear error", () => {
    const registry = new CommandRegistry();
    registerBuiltinCommands(registry);
    const command = registry.get("env");
    expect(() => command?.run(fakeContext(), [])).toThrow("requires a name");
  });

  test("env with a name calls switchEnvironment", async () => {
    const registry = new CommandRegistry();
    registerBuiltinCommands(registry);
    const command = registry.get("env");
    let switchedTo: string | undefined;
    const ctx = {
      ...fakeContext(),
      switchEnvironment: (name: string) => {
        switchedTo = name;
      },
    };
    await command?.run(ctx, ["staging"]);
    expect(switchedTo).toBe("staging");
  });
});
