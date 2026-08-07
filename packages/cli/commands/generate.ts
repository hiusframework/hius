import { defineCommand } from "citty";
import { consola } from "consola";
import { generateDomain } from "../generators/domain";
import type { HttpMethod } from "../generators/endpoint";
import { generateEndpoint } from "../generators/endpoint";
import { generateEvent } from "../generators/event";
import { generateMcpTool } from "../generators/mcp-tool";
import { generateModel } from "../generators/model";
import { type Acronyms, createAcronyms } from "../generators/naming";
import { generateUseCase } from "../generators/use-case";
import type { WriteResult } from "../generators/write-file";

const dirArg = {
  type: "string",
  description: "Path to the domains/ directory",
  default: "domains",
} as const;

const forceArg = {
  type: "boolean",
  description: "Overwrite files that already exist",
} as const;

// Which words to render with their own exact casing (API, HR, GraphQL)
// instead of the default capitalize-first-letter-only behavior — see
// packages/cli/generators/naming.ts. No defaults are built in; this is
// entirely project-specific, the same reasoning resolveLocale ships no
// translation catalog.
const acronymArg = {
  type: "string",
  description: "Comma-separated words to preserve exact casing for, e.g. API,HR,GraphQL",
} as const;

function parseAcronyms(raw: string | undefined): Acronyms | undefined {
  if (!raw) return undefined;
  const words = raw
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  return words.length > 0 ? createAcronyms(words) : undefined;
}

function reportResults(results: WriteResult[]): void {
  for (const result of results) {
    if (result.skipped) {
      consola.warn(`${result.path} already exists, skipped (use --force to overwrite)`);
    } else {
      consola.success(result.path);
    }
  }
}

const domainCommand = defineCommand({
  meta: { name: "domain", description: "Scaffold a new domain" },
  args: {
    name: { type: "positional", description: "Domain name", required: true },
    dir: dirArg,
    force: forceArg,
  },
  async run({ args }) {
    reportResults(await generateDomain(args.dir, args.name, args.force));
  },
});

const useCaseCommand = defineCommand({
  meta: { name: "use-case", description: "Generate a citadel use case" },
  args: {
    domain: { type: "positional", description: "Domain the use case belongs to", required: true },
    name: { type: "positional", description: "Use case name", required: true },
    dir: dirArg,
    force: forceArg,
    acronym: acronymArg,
  },
  async run({ args }) {
    reportResults(
      await generateUseCase(
        args.dir,
        args.domain,
        args.name,
        args.force,
        parseAcronyms(args.acronym),
      ),
    );
  },
});

const endpointCommand = defineCommand({
  meta: { name: "endpoint", description: "Generate an HTTP endpoint handler" },
  args: {
    domain: { type: "positional", description: "Domain the endpoint belongs to", required: true },
    method: {
      type: "positional",
      description: "HTTP method (GET/POST/PUT/PATCH/DELETE)",
      required: true,
    },
    path: { type: "positional", description: "Route path, e.g. /invoices/:id", required: true },
    dir: dirArg,
    force: forceArg,
    acronym: acronymArg,
  },
  async run({ args }) {
    const method = args.method.toUpperCase() as HttpMethod;
    const { results, wiringSnippet } = await generateEndpoint(
      args.dir,
      args.domain,
      method,
      args.path,
      args.force,
      parseAcronyms(args.acronym),
    );
    reportResults(results);
    consola.info(`Wire it in: ${wiringSnippet}`);
  },
});

const eventCommand = defineCommand({
  meta: { name: "event", description: "Generate an event handler" },
  args: {
    domain: { type: "positional", description: "Domain the handler belongs to", required: true },
    name: { type: "positional", description: "Event name, e.g. invoice.paid", required: true },
    dir: dirArg,
    force: forceArg,
    acronym: acronymArg,
  },
  async run({ args }) {
    const { results, wiringSnippet } = await generateEvent(
      args.dir,
      args.domain,
      args.name,
      args.force,
      parseAcronyms(args.acronym),
    );
    reportResults(results);
    consola.info(`Wire it in: ${wiringSnippet}`);
  },
});

const mcpToolCommand = defineCommand({
  meta: {
    name: "mcp-tool",
    description: "Generate a contract exposed as an MCP tool by the app's MCP adapter",
  },
  args: {
    domain: { type: "positional", description: "Domain the operation belongs to", required: true },
    name: {
      type: "positional",
      description: "Operation name, e.g. ChargeCustomer",
      required: true,
    },
    dir: dirArg,
    force: forceArg,
    acronym: acronymArg,
  },
  async run({ args }) {
    const { results, contractVarName, wiringSnippet } = await generateMcpTool(
      args.dir,
      args.domain,
      args.name,
      args.force,
      parseAcronyms(args.acronym),
    );
    reportResults(results);
    consola.info(
      `Import the contract as \`${contractVarName}\`, then wire it in: ${wiringSnippet}`,
    );
  },
});

const modelCommand = defineCommand({
  meta: {
    name: "model",
    description: "Generate a Drizzle schema — Active Record-style ergonomics",
  },
  args: {
    domain: { type: "positional", description: "Domain the model belongs to", required: true },
    name: { type: "positional", description: "Model name, e.g. Invoice", required: true },
    dir: dirArg,
    force: forceArg,
    acronym: acronymArg,
  },
  async run({ args }) {
    // Field specs (amount:money status:string ...) are whatever positional
    // tokens remain after domain/name — citty exposes every raw positional
    // via args._, unaffected by which ones were also claimed by name.
    const fieldArgs = args._.slice(2);
    reportResults(
      await generateModel(
        args.dir,
        args.domain,
        args.name,
        fieldArgs,
        args.force,
        parseAcronyms(args.acronym),
      ),
    );
  },
});

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Scaffold a domain, use case, endpoint, event handler, MCP tool, or model",
  },
  subCommands: {
    domain: domainCommand,
    "use-case": useCaseCommand,
    endpoint: endpointCommand,
    event: eventCommand,
    "mcp-tool": mcpToolCommand,
    model: modelCommand,
  },
});
