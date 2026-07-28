// server/schema/validator.ts
import { PaneTeraCardSchema, CardDataPayload, SchemaField } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCardSchema(schema: unknown): ValidationResult {
  const errors: string[] = [];
  if (!schema || typeof schema !== 'object') {
    return { valid: false, errors: ['Schema must be an object'] };
  }

  const s = schema as Partial<PaneTeraCardSchema>;

  if (!s.id || typeof s.id !== 'string') {
    errors.push('id is required and must be a string (e.g. "domain.name")');
  }
  if (!s.version || typeof s.version !== 'string') {
    errors.push('version is required and must be a string');
  }
  if (!s.domain || typeof s.domain !== 'string') {
    errors.push('domain is required and must be a string');
  }

  const validTypes = ['status-board', 'metric-group', 'diff', 'proposal-gate', 'form'];
  if (!s.type || !validTypes.includes(s.type)) {
    errors.push(`type must be one of: ${validTypes.join(', ')}`);
  }

  if (!Array.isArray(s.fields)) {
    errors.push('fields must be an array');
  } else {
    s.fields.forEach((field, i) => {
      if (!field.name || typeof field.name !== 'string') {
        errors.push(`fields[${i}].name is required`);
      }
      if (!field.type || typeof field.type !== 'string') {
        errors.push(`fields[${i}].type is required`);
      }
    });
  }

  if (s.actions && !Array.isArray(s.actions)) {
    errors.push('actions must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCardData(schema: PaneTeraCardSchema, data: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  for (const field of schema.fields) {
    const val = data[field.name];

    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push(`Field "${field.label || field.name}" is required.`);
      continue;
    }

    if (val !== undefined && val !== null) {
      if (field.type === 'number' && typeof val !== 'number' && isNaN(Number(val))) {
        errors.push(`Field "${field.name}" must be a number.`);
      } else if (field.type === 'boolean' && typeof val !== 'boolean') {
        errors.push(`Field "${field.name}" must be a boolean.`);
      } else if (field.type === 'array' && !Array.isArray(val)) {
        errors.push(`Field "${field.name}" must be an array.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
