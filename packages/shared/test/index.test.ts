import { expect, test } from "bun:test";
import { PACKAGE_NAME } from "@/index";

test("package identity", () => {
  expect(PACKAGE_NAME).toBe("@hius/shared");
});
