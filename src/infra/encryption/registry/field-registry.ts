// FieldRegistry is the central configuration for encrypted fields.
// It maps logical field names (what the domain sees) to physical DB columns.
// Repositories read this to know how to encrypt writes and rewrite queries.

export type FieldConfig = {
  encrypted: true;
  // Physical column that stores the ciphertext
  field: string;
  // If true, a blind index column must also exist for equality search
  searchable: boolean;
  // Physical column for the blind index hash (required when searchable: true)
  hashField?: string;
};

// A model's complete field map: logicalName → config
export type ModelConfig = Record<string, FieldConfig>;

export interface FieldRegistry {
  register(model: string, config: ModelConfig): void;
  getModel(model: string): ModelConfig | undefined;
  getField(model: string, logicalField: string): FieldConfig | undefined;
}

export function createFieldRegistry(): FieldRegistry {
  const store = new Map<string, ModelConfig>();

  function register(model: string, config: ModelConfig): void {
    if (store.has(model)) {
      throw new Error(`[Hius/Registry] Model "${model}" is already registered`);
    }
    store.set(model, config);
  }

  function getModel(model: string): ModelConfig | undefined {
    return store.get(model);
  }

  function getField(model: string, logicalField: string): FieldConfig | undefined {
    return store.get(model)?.[logicalField];
  }

  return { register, getModel, getField };
}
