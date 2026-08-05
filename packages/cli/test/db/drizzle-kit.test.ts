import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SQL } from "bun";
import { runDrizzleKit } from "@/db/drizzle-kit";

test("spawns bunx drizzle-kit with the given args", async () => {
  let calledWith: string[] | undefined;
  await runDrizzleKit(["generate", "--name", "init"], {
    spawn: (cmd) => {
      calledWith = cmd;
      return { exited: Promise.resolve(0) };
    },
  });

  expect(calledWith).toEqual(["bunx", "drizzle-kit", "generate", "--name", "init"]);
});

test("passes cwd through to the spawn call", async () => {
  let calledCwd: string | undefined;
  await runDrizzleKit(["studio"], {
    cwd: "/some/app/dir",
    spawn: (_cmd, options) => {
      calledCwd = options.cwd;
      return { exited: Promise.resolve(0) };
    },
  });

  expect(calledCwd).toBe("/some/app/dir");
});

test("throws when drizzle-kit exits non-zero", async () => {
  expect(
    runDrizzleKit(["migrate"], {
      spawn: () => ({ exited: Promise.resolve(1) }),
    }),
  ).rejects.toThrow("drizzle-kit migrate exited with code 1");
});

const hasDb = !!process.env.DATABASE_URL;

describe.if(hasDb)("generate + migrate against a real database", () => {
  // A real drizzle-kit process needs "drizzle-kit"/"drizzle-orm" to
  // resolve as bare specifiers from the generated config/schema files, so
  // the temp project lives under this package (a direct dependency of
  // @hius/cli) rather than the OS tmpdir.
  const tableName = `hius_cli_test_widgets_${randomUUID().replaceAll("-", "_")}`;
  const sql = new SQL(process.env.DATABASE_URL ?? "");

  afterAll(async () => {
    await sql`DROP TABLE IF EXISTS ${sql(tableName)}`;
    await sql.close();
  });

  test("generate produces a migration file, migrate applies it", async () => {
    const projectDir = await mkdtemp(join(import.meta.dir, ".tmp-drizzle-kit-"));
    try {
      await writeFile(
        join(projectDir, "drizzle.config.ts"),
        `import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
`,
      );
      await writeFile(
        join(projectDir, "schema.ts"),
        `import { pgTable, text, uuid } from "drizzle-orm/pg-core";

export const widgets = pgTable("${tableName}", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});
`,
      );

      await runDrizzleKit(["generate"], { cwd: projectDir });

      const migrationFiles = (await readdir(join(projectDir, "drizzle"))).filter((f) =>
        f.endsWith(".sql"),
      );
      expect(migrationFiles.length).toBeGreaterThan(0);

      await runDrizzleKit(["migrate"], { cwd: projectDir });

      const [{ exists }] = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = ${tableName}
        ) AS exists
      `;
      expect(exists).toBe(true);
    } finally {
      await rm(projectDir, { recursive: true, force: true });
    }
  }, 30000);
});
