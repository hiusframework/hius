export type SpawnFn = (cmd: string[], options: { cwd?: string }) => { exited: Promise<number> };

export type RunDrizzleKitOptions = {
  cwd?: string;
  // Injectable for tests — real usage always goes through Bun.spawn.
  // Not a general DI mechanism, just the one seam a subprocess call needs
  // to be testable without actually shelling out.
  spawn?: SpawnFn;
};

/**
 * Runs drizzle-kit via `bunx` rather than importing its CLI programmatically
 * — drizzle-kit's own binary already resolves `drizzle.config.ts`, connects
 * to the database, and handles interactive prompts (e.g. destructive schema
 * changes); reimplementing any of that would be exactly the kind of "clever"
 * duplication this project avoids. This is a thin, inherited-stdio wrapper.
 */
export async function runDrizzleKit(
  args: string[],
  options: RunDrizzleKitOptions = {},
): Promise<void> {
  const spawn = options.spawn ?? defaultSpawn;
  const proc = spawn(["bunx", "drizzle-kit", ...args], { cwd: options.cwd });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`drizzle-kit ${args[0] ?? ""} exited with code ${exitCode}`);
  }
}

function defaultSpawn(cmd: string[], options: { cwd?: string }): { exited: Promise<number> } {
  return Bun.spawn(cmd, {
    cwd: options.cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
}
