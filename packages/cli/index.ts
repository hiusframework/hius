#!/usr/bin/env bun
import { PACKAGE_NAME as CORE_PACKAGE_NAME } from "@hius/core";
import { PACKAGE_NAME as RUNTIME_PACKAGE_NAME } from "hius";

// Placeholder — citty-based command surface lands here: new/generate/dev/
// console/validate/explain/contract diff/build/deploy.
export const PACKAGE_NAME = "@hius/cli" as const;
export { CORE_PACKAGE_NAME, RUNTIME_PACKAGE_NAME };

if (import.meta.main) {
  console.log(
    `${PACKAGE_NAME} scaffold — core: ${CORE_PACKAGE_NAME}, runtime: ${RUNTIME_PACKAGE_NAME}`,
  );
}
