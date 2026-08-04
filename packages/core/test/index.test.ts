import { expect, test } from "bun:test";
import { PACKAGE_NAME, SPEC_PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/core");
});

test("resolves workspace dependency @hius/spec", () => {
  expect(SPEC_PACKAGE_NAME).toBe("@hius/spec");
});
