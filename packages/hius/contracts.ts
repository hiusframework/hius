import type { Contract } from "@hius/spec";
import { z } from "zod";

function isContract(value: unknown): value is Contract {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Contract).name === "string" &&
    typeof (value as Contract).version === "string" &&
    (value as Contract).input instanceof z.ZodType &&
    (value as Contract).output instanceof z.ZodType
  );
}

/**
 * Loads the contracts a domain exports under `citadel/contracts/` — one
 * `defineContract()` call, default-exported, per file. `relFiles` is the
 * domain's `files.contracts` list from discovery, so this never has to
 * re-derive which files to import.
 */
export async function loadContracts(
  appsDir: string,
  domainName: string,
  relFiles: string[],
): Promise<Contract[]> {
  return Promise.all(
    relFiles.map(async (relFile) => {
      const path = `${appsDir}/${domainName}/${relFile}`;
      const mod = await import(path);
      if (!isContract(mod.default)) {
        throw new Error(
          `${path}: default export is not a Contract — did you forget to wrap it in defineContract()?`,
        );
      }
      return mod.default;
    }),
  );
}
