import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type WriteResult = {
  path: string;
  skipped: boolean;
};

/**
 * Writes a generated file, refusing to clobber an existing one unless
 * `force` is set. A generator that silently overwrites on re-run is a
 * real, previously-shipped bug (a legacy CLI generator did exactly
 * this) — every generator in this package goes through here specifically
 * so that mistake isn't repeatable.
 */
export async function writeGeneratedFile(
  path: string,
  contents: string,
  force = false,
): Promise<WriteResult> {
  if (!force && (await Bun.file(path).exists())) {
    return { path, skipped: true };
  }

  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, contents);
  return { path, skipped: false };
}
