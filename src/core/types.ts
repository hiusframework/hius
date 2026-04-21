// Core type vocabulary for the Hius DI system.

// biome-ignore lint/suspicious/noExplicitAny: Constructor type must accept any class
export type Constructor<T = any> = new (...args: any[]) => T;

// A token uniquely identifies a provider. Class constructors are the default token.
export type Token<T = unknown> = Constructor<T> | symbol | string;

export interface ModuleMetadata {
  name: string;
  imports?: Constructor[]; // other @Module classes this module depends on
  providers?: Constructor[]; // @Injectable classes registered in this module
  exports?: Constructor[]; // subset of providers visible to importing modules
}

export interface InjectableMetadata {
  deps: Constructor[]; // ordered list matching constructor parameter positions
}
