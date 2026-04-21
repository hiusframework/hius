/**
 * docs/sync-check.ts
 *
 * Verifies that every file in docs/en/ has a counterpart in docs/ru/ and vice versa.
 * Run: mise run docs:sync
 * Exit code 1 if any files are missing — suitable for CI.
 */

import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DOCS_DIR = new URL(".", import.meta.url).pathname;
const EN = join(DOCS_DIR, "en");
const RU = join(DOCS_DIR, "ru");

function collectFiles(dir: string, base = dir): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full, base));
    } else if (entry.endsWith(".md")) {
      files.push(relative(base, full));
    }
  }
  return files.sort();
}

const enFiles = new Set(collectFiles(EN));
const ruFiles = new Set(collectFiles(RU));

const missingInRu = [...enFiles].filter((f) => !ruFiles.has(f));
const missingInEn = [...ruFiles].filter((f) => !enFiles.has(f));

let ok = true;

if (missingInRu.length > 0) {
  ok = false;
  console.error("❌ Missing in docs/ru/:");
  missingInRu.forEach((f) => console.error(`   ${f}`));
}

if (missingInEn.length > 0) {
  ok = false;
  console.error("❌ Missing in docs/en/:");
  missingInEn.forEach((f) => console.error(`   ${f}`));
}

if (ok) {
  console.log(`✅ docs in sync — ${enFiles.size} files × 2 languages`);
} else {
  process.exit(1);
}
