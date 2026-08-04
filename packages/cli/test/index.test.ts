import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "citty";
import { PACKAGE_NAME, validateCommand } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/cli");
});

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

  test("throws with the violation message when a domain has no module.config", async () => {
    await writeFileIn("billing", "routes.ts", "export const routes = [];\n");

    expect(runCommand(validateCommand, { rawArgs: ["--dir", appsDir] })).rejects.toThrow(
      /no module.config found for `billing`/,
    );
  });

  test('--dir defaults to "apps" when omitted', async () => {
    // No fixture at ./apps relative to cwd is asserted here — this just
    // confirms the arg default resolves instead of throwing on a missing
    // required arg. An empty (nonexistent) apps/ dir validates cleanly.
    await expect(runCommand(validateCommand, { rawArgs: [] })).resolves.toBeDefined();
  });
});
