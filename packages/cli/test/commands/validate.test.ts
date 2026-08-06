import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import { consola } from "consola";
import { validateCommand } from "@/commands/validate";

describe("hius validate", () => {
  let appsDir: string;

  beforeEach(async () => {
    appsDir = await mkdtemp(join(tmpdir(), "hius-cli-validate-"));
  });

  afterEach(async () => {
    await rm(appsDir, { recursive: true, force: true });
  });

  async function writeFileIn(
    domain: string,
    relativePath: string,
    contents: string,
  ): Promise<void> {
    const fullPath = join(appsDir, domain, relativePath);
    await mkdir(join(fullPath, ".."), { recursive: true });
    await writeFile(fullPath, contents);
  }

  test("resolves cleanly when every domain is declared and matches", async () => {
    await writeFileIn(
      "billing",
      "module.config.ts",
      `export default { name: "billing", publicApi: [], allowedDependencies: [] };\n`,
    );

    await expect(
      runCommand(validateCommand, { rawArgs: ["--dir", appsDir] }),
    ).resolves.toBeDefined();
  });

  test("prints the violation message via consola and throws a summary for the exit code", async () => {
    const errorSpy = spyOn(consola, "error").mockImplementation(
      (() => undefined) as unknown as typeof consola.error,
    );
    await writeFileIn("billing", "routes.ts", "export const routes = [];\n");

    await expect(runCommand(validateCommand, { rawArgs: ["--dir", appsDir] })).rejects.toThrow(
      "1 boundary violation(s) found",
    );
    expect(errorSpy.mock.calls[0]?.[0]).toContain("no module.config found for `billing`");

    errorSpy.mockRestore();
  });

  test('--dir defaults to "domains" when omitted', async () => {
    // No fixture at ./domains relative to cwd is asserted here — this
    // just confirms the arg default resolves instead of throwing on a
    // missing required arg. An empty (nonexistent) domains/ dir
    // validates cleanly.
    await expect(runCommand(validateCommand, { rawArgs: [] })).resolves.toBeDefined();
  });
});
