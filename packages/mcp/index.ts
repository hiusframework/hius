import { PACKAGE_NAME as CORE_PACKAGE_NAME } from "@hius/core";
import { PACKAGE_NAME as RUNTIME_PACKAGE_NAME } from "hius";

// Placeholder — MCP server over the same core as the CLI (one core, two
// interfaces): get_architecture, get_domain, get_contracts, validate_change,
// where_does_event_go.
export const PACKAGE_NAME = "@hius/mcp" as const;
export { CORE_PACKAGE_NAME, RUNTIME_PACKAGE_NAME };
