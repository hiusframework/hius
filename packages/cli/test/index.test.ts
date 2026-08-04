import { expect, test } from "bun:test";
import { CORE_PACKAGE_NAME, PACKAGE_NAME, RUNTIME_PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/cli");
});

test("resolves workspace dependencies @hius/core and hius", () => {
  expect(CORE_PACKAGE_NAME).toBe("@hius/core");
  expect(RUNTIME_PACKAGE_NAME).toBe("hius");
});
