import { defineCommand } from "citty";
import { consola } from "consola";
import { generateApp } from "../generators/app";
import type { HttpMethod } from "../generators/endpoint";
import { generateEndpoint } from "../generators/endpoint";
import { generateEvent } from "../generators/event";
import { generateModel } from "../generators/model";
import { generateUseCase } from "../generators/use-case";
import type { WriteResult } from "../generators/write-file";

const dirArg = {
  type: "string",
  description: "Path to the apps/ directory",
  default: "apps",
} as const;

const forceArg = {
  type: "boolean",
  description: "Overwrite files that already exist",
} as const;

function reportResults(results: WriteResult[]): void {
  for (const result of results) {
    if (result.skipped) {
      consola.warn(`${result.path} already exists, skipped (use --force to overwrite)`);
    } else {
      consola.success(result.path);
    }
  }
}

const appCommand = defineCommand({
  meta: { name: "app", description: "Scaffold a new domain" },
  args: {
    name: { type: "positional", description: "Domain name", required: true },
    dir: dirArg,
    force: forceArg,
  },
  async run({ args }) {
    reportResults(await generateApp(args.dir, args.name, args.force));
  },
});

const useCaseCommand = defineCommand({
  meta: { name: "use-case", description: "Generate a citadel use case" },
  args: {
    domain: { type: "positional", description: "Domain the use case belongs to", required: true },
    name: { type: "positional", description: "Use case name", required: true },
    dir: dirArg,
    force: forceArg,
  },
  async run({ args }) {
    reportResults(await generateUseCase(args.dir, args.domain, args.name, args.force));
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
  },
  async run({ args }) {
    const method = args.method.toUpperCase() as HttpMethod;
    const { results, wiringSnippet } = await generateEndpoint(
      args.dir,
      args.domain,
      method,
      args.path,
      args.force,
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
  },
  async run({ args }) {
    const { results, wiringSnippet } = await generateEvent(
      args.dir,
      args.domain,
      args.name,
      args.force,
    );
    reportResults(results);
    consola.info(`Wire it in: ${wiringSnippet}`);
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
  },
  async run({ args }) {
    // Field specs (amount:money status:string ...) are whatever positional
    // tokens remain after domain/name — citty exposes every raw positional
    // via args._, unaffected by which ones were also claimed by name.
    const fieldArgs = args._.slice(2);
    reportResults(await generateModel(args.dir, args.domain, args.name, fieldArgs, args.force));
  },
});

export const generateCommand = defineCommand({
  meta: {
    name: "generate",
    description: "Scaffold a domain, use case, endpoint, event handler, or model",
  },
  subCommands: {
    app: appCommand,
    "use-case": useCaseCommand,
    endpoint: endpointCommand,
    event: eventCommand,
    model: modelCommand,
  },
});
