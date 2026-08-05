import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "citty";
import { consola } from "consola";
import { contractCommand } from "@/commands/contract";

// Fixtures import "zod" by bare specifier to construct real schema
// instances, so temp dirs live under this package (packages/cli depends
// on zod directly) rather than the OS tmpdir — node_modules resolution
// only finds it walking up from here.
let beforeDir: string;
let afterDir: string;

beforeEach(async () => {
  beforeDir = await mkdtemp(join(import.meta.dir, ".tmp-contract-diff-before-"));
  afterDir = await mkdtemp(join(import.meta.dir, ".tmp-contract-diff-after-"));
});

afterEach(async () => {
  await rm(beforeDir, { recursive: true, force: true });
  await rm(afterDir, { recursive: true, force: true });
});

async function writeContract(
  root: string,
  domain: string,
  fileName: string,
  contents: string,
): Promise<void> {
  const fullPath = join(root, domain, "citadel", "contracts", fileName);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, contents);
}

const CHARGE_CUSTOMER_V1 = `import { z } from "zod";
export default {
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string() }),
  output: z.object({ chargeId: z.string() }),
};
`;

describe("hius contract diff", () => {
  test("reports no changes and succeeds when both sides match", async () => {
    await writeContract(beforeDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);
    await writeContract(afterDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);

    const successSpy = spyOn(consola, "success").mockImplementation(
      (() => undefined) as unknown as typeof consola.success,
    );

    await expect(
      runCommand(contractCommand, {
        rawArgs: ["diff", "--dir", afterDir, "--against", beforeDir],
      }),
    ).resolves.toBeDefined();
    expect(successSpy.mock.calls.some((call) => call[0] === "contract diff: no changes")).toBe(
      true,
    );

    successSpy.mockRestore();
  });

  test("reports a patch change without failing the command", async () => {
    await writeContract(beforeDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);
    await writeContract(
      afterDir,
      "billing",
      "charge-customer.ts",
      `import { z } from "zod";
export default {
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string(), note: z.string().optional() }),
  output: z.object({ chargeId: z.string() }),
};
`,
    );

    const successSpy = spyOn(consola, "success").mockImplementation(
      (() => undefined) as unknown as typeof consola.success,
    );

    await expect(
      runCommand(contractCommand, {
        rawArgs: ["diff", "--dir", afterDir, "--against", beforeDir],
      }),
    ).resolves.toBeDefined();
    expect(successSpy.mock.calls.some((call) => String(call[0]).includes("[patch]"))).toBe(true);

    successSpy.mockRestore();
  });

  test("fails the command on a major (breaking) change", async () => {
    await writeContract(beforeDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);
    await writeContract(
      afterDir,
      "billing",
      "charge-customer.ts",
      `import { z } from "zod";
export default {
  name: "ChargeCustomer",
  version: "1.0.0",
  input: z.object({ customerId: z.string(), amount: z.number() }),
  output: z.object({ chargeId: z.string() }),
};
`,
    );

    const errorSpy = spyOn(consola, "error").mockImplementation(
      (() => undefined) as unknown as typeof consola.error,
    );

    await expect(
      runCommand(contractCommand, {
        rawArgs: ["diff", "--dir", afterDir, "--against", beforeDir],
      }),
    ).rejects.toThrow("major (breaking) change(s) found");
    expect(
      errorSpy.mock.calls.some((call) => String(call[0]).includes("gained new required field")),
    ).toBe(true);

    errorSpy.mockRestore();
  });

  test("reports a new operation as minor", async () => {
    await writeContract(beforeDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);
    await writeContract(afterDir, "billing", "charge-customer.ts", CHARGE_CUSTOMER_V1);
    await writeContract(
      afterDir,
      "billing",
      "refund-customer.ts",
      `import { z } from "zod";
export default {
  name: "RefundCustomer",
  version: "1.0.0",
  input: z.object({ chargeId: z.string() }),
  output: z.object({ refundId: z.string() }),
};
`,
    );

    const infoSpy = spyOn(consola, "info").mockImplementation(
      (() => undefined) as unknown as typeof consola.info,
    );

    await expect(
      runCommand(contractCommand, {
        rawArgs: ["diff", "--dir", afterDir, "--against", beforeDir],
      }),
    ).resolves.toBeDefined();
    expect(infoSpy.mock.calls.some((call) => String(call[0]).includes("[minor]"))).toBe(true);

    infoSpy.mockRestore();
  });
});
