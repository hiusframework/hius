import type { Contract } from "@hius/spec";
import { z } from "zod";
import { discoverDomains } from "./discovery";

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

/**
 * Loads every contract across every domain under `appsDir` — what
 * `hius contract diff` compares two snapshots of. Contracts are matched
 * across snapshots by name alone (see `@hius/core`'s diffContracts), so
 * this intentionally flattens across domains rather than keeping them
 * grouped: operation names are expected to be unique app-wide, the same
 * namespace an MCP tool or RPC call would address them in.
 */
export async function loadAllContracts(appsDir: string): Promise<Contract[]> {
  const domains = await discoverDomains(appsDir);
  const perDomain = await Promise.all(
    domains.map((domain) => loadContracts(appsDir, domain.name, domain.files.contracts)),
  );
  return perDomain.flat();
}
