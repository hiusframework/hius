// Entry point for seed runner.
// Usage: bun seeds/run.ts <env>
//   env: "dev" | "test"

import { resolve } from "node:path";
import { runSeeds } from "./runner";

const env = process.argv[2];
if (env !== "dev" && env !== "test") {
  console.error('Usage: bun seeds/run.ts <env>  (env: "dev" | "test")');
  process.exit(1);
}

const dir = resolve(import.meta.dir, env);
console.log(`Running ${env} seeds from ${dir}...`);
await runSeeds(dir);
console.log("Done.");
