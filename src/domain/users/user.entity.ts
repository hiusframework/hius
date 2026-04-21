// Pure domain type — no DB, no framework, no decorators.
export type User = {
  id: string;
  email: string;
  name?: string;
};
