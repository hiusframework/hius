import { getMetadata } from "../utils/metadata.ts";
import { MODULE_KEY } from "./decorators.ts";
import { Container } from "./container.ts";
import { registerProvider } from "./injector.ts";
import type { Constructor, ModuleMetadata } from "./types.ts";

/**
 * Recursively load a module tree into a container.
 * visited prevents duplicate processing of shared imported modules.
 */
function loadModule(
  container: Container,
  moduleCls: Constructor,
  visited: Set<Constructor>
): void {
  if (visited.has(moduleCls)) return;
  visited.add(moduleCls);

  const meta = getMetadata<ModuleMetadata>(MODULE_KEY, moduleCls);
  if (!meta) {
    throw new Error(`[Hius] ${moduleCls.name} is not decorated with @Module()`);
  }

  // Imported modules are loaded first so their providers are available
  for (const imported of meta.imports ?? []) {
    loadModule(container, imported, visited);
  }

  // Register this module's own providers
  for (const provider of meta.providers ?? []) {
    registerProvider(container, provider);
  }
}

/**
 * Bootstrap the application from the root module.
 * Returns a configured container ready to resolve providers.
 */
export function bootstrapModule(rootModule: Constructor): Container {
  const container = new Container();
  loadModule(container, rootModule, new Set());
  return container;
}
