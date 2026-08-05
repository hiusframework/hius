import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeGeneratedFile } from "@/generators/write-file";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "hius-write-file-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeGeneratedFile", () => {
  test("creates the file and any missing parent directories", async () => {
    const path = join(dir, "nested", "deep", "file.ts");
    const result = await writeGeneratedFile(path, "export const x = 1;\n");

    expect(result).toEqual({ path, skipped: false });
    expect(await Bun.file(path).text()).toBe("export const x = 1;\n");
  });

  test("refuses to overwrite an existing file by default", async () => {
    const path = join(dir, "file.ts");
    await writeGeneratedFile(path, "original");

    const result = await writeGeneratedFile(path, "overwritten");

    expect(result).toEqual({ path, skipped: true });
    expect(await Bun.file(path).text()).toBe("original");
  });

  test("force: true overwrites an existing file", async () => {
    const path = join(dir, "file.ts");
    await writeGeneratedFile(path, "original");

    const result = await writeGeneratedFile(path, "overwritten", true);

    expect(result).toEqual({ path, skipped: false });
    expect(await Bun.file(path).text()).toBe("overwritten");
  });
});
