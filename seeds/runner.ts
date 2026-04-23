// Seed runner — executes all seed files in a given directory in sorted order.
// Each seed file must export a default async function.
//
// Usage: called internally by seeds/run.ts, not directly.

import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export async function runSeeds(dir: string): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(dir))
      .filter((f) => f.endsWith(".ts") && !f.startsWith("_"))
      .sort();
  } catch {
    console.error(`Seeds directory not found: ${dir}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log("No seed files found.");
    return;
  }

  for (const file of files) {
    const path = resolve(dir, file);
    console.log(`  → ${file}`);
    const mod = await import(path);
    if (typeof mod.default !== "function") {
      throw new Error(`Seed file must export a default function: ${file}`);
    }
    await mod.default();
  }
}
