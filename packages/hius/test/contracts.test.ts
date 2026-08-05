import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadContracts } from "@/contracts";

// Fixtures import "zod" by bare specifier to construct real schema
// instances (loadContracts checks `input instanceof z.ZodType`), so the
// temp dir has to live under this package rather than the OS tmpdir —
// only here does node_modules resolution find the hoisted "zod".
let appsDir: string;

beforeEach(async () => {
  appsDir = await mkdtemp(join(import.meta.dir, ".tmp-contracts-"));
});

afterEach(async () => {
  await rm(appsDir, { recursive: true, force: true });
});

async function writeContractFile(domain: string, relPath: string, contents: string): Promise<void> {
  const fullPath = join(appsDir, domain, relPath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

test("loads a Contract defined with defineContract", async () => {
  await writeContractFile(
    "billing",
    "citadel/contracts/charge-customer.ts",
    `import { z } from "zod";

export default {
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
};
`,
  );

  const contracts = await loadContracts(appsDir, "billing", [
    "citadel/contracts/charge-customer.ts",
  ]);

  expect(contracts).toHaveLength(1);
  expect(contracts[0]?.name).toBe("ChargeCustomer");
  expect(contracts[0]?.version).toBe("1.0.0");
});

test("loads multiple contract files in order", async () => {
  await writeContractFile(
    "billing",
    "citadel/contracts/charge-customer.ts",
    `import { z } from "zod";
export default { name: "ChargeCustomer", version: "1.0.0", input: z.object({}), output: z.object({}) };
`,
  );
  await writeContractFile(
    "billing",
    "citadel/contracts/refund-customer.ts",
    `import { z } from "zod";
export default { name: "RefundCustomer", version: "1.0.0", input: z.object({}), output: z.object({}) };
`,
  );

  const contracts = await loadContracts(appsDir, "billing", [
    "citadel/contracts/charge-customer.ts",
    "citadel/contracts/refund-customer.ts",
  ]);

  expect(contracts.map((c) => c.name)).toEqual(["ChargeCustomer", "RefundCustomer"]);
});

test("throws a clear error when the default export isn't a Contract", async () => {
  await writeContractFile(
    "billing",
    "citadel/contracts/broken.ts",
    `export default { oops: true };\n`,
  );

  expect(loadContracts(appsDir, "billing", ["citadel/contracts/broken.ts"])).rejects.toThrow(
    "default export is not a Contract",
  );
});
