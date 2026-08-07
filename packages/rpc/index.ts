import type { Contract, ContractBinding } from "@hius/spec";
import type { z } from "zod";

export const PACKAGE_NAME = "@hius/rpc" as const;

// The RPC / Contract-Client Adapter — a framework-agnostic typed client
// for calling domain operations from any web framework, without
// committing to one. Generated from the same contracts as the
// Application MCP Adapter (@hius/mcp-adapter): same source, different
// purpose — that one exposes contracts as MCP tools for external agents,
// this one gives application code a typed client to call them directly.
//
// The transport is deliberately swappable — two implementations today:
// createLocalTransport (direct in-process call, for when the caller runs
// in the same process as the bindings) and createHttpTransport (a real
// network call, for when it doesn't — e.g. a separately deployed
// frontend). Either way `client.call(SomeContract, input)` looks
// identical; nothing about the client branches on which transport is
// active.

export type RpcTransport = {
  call<Input extends z.ZodType, Output extends z.ZodType>(
    contract: Contract<Input, Output>,
    input: z.infer<Input>,
  ): Promise<z.infer<Output>>;
};

/**
 * Direct in-process transport: looks up the bound handler by contract
 * name and calls it. Input is parsed against the contract's input
 * schema before the handler runs; the handler's result is parsed
 * against the output schema before it's returned — that second parse is
 * what keeps the caller from ever seeing a field the contract doesn't
 * explicitly declare, even if the handler's return value has more on it
 * (Zod strips unrecognized object keys by default).
 */
export function createLocalTransport(bindings: ContractBinding[]): RpcTransport {
  const byName = new Map(bindings.map((binding) => [binding.contract.name, binding]));

  return {
    async call(contract, input) {
      const binding = byName.get(contract.name);
      if (!binding) {
        throw new Error(`No handler bound for contract "${contract.name}"`);
      }
      const parsedInput = contract.input.parse(input);
      const output = await binding.handler(parsedInput);
      return contract.output.parse(output);
    },
  };
}

export type RpcClient = {
  call: RpcTransport["call"];
};

/**
 * The public entry point — a thin wrapper over whichever transport is
 * active. Callers never branch on dev vs. prod: `client.call(SomeContract,
 * input)` is identical either way, no matter what `transport` turns out
 * to be.
 */
export function createRpcClient(transport: RpcTransport): RpcClient {
  return {
    call(contract, input) {
      return transport.call(contract, input);
    },
  };
}

export type { RpcCodec } from "./codec";
export { cborCodec, codecFor, jsonCodec } from "./codec";
export { RpcError } from "./errors";
export { createHttpRpcServer } from "./http-server";
export type { HttpTransportOptions } from "./http-transport";
export { createHttpTransport } from "./http-transport";
