// src/components/schema/SchemaCardRegistry.ts
import { PaneTeraCardSchema } from '../../../shared/schemaTypes';

class ClientSchemaRegistry {
  private cache: Map<string, PaneTeraCardSchema> = new Map();

  public async getSchema(schemaId: string): Promise<PaneTeraCardSchema | null> {
    if (this.cache.has(schemaId)) {
      return this.cache.get(schemaId)!;
    }

    try {
      const resp = await fetch(`/api/schemas/${encodeURIComponent(schemaId)}`);
      if (!resp.ok) return null;
      const schema: PaneTeraCardSchema = await resp.json();
      this.cache.set(schemaId, schema);
      return schema;
    } catch {
      return null;
    }
  }

  public setSchema(schema: PaneTeraCardSchema): void {
    this.cache.set(schema.id, schema);
  }
}

export const schemaCardRegistry = new ClientSchemaRegistry();
