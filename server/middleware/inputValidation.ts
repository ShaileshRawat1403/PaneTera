// server/middleware/inputValidation.ts
//
// Input validation and sanitization middleware.

import { Request, Response, NextFunction } from 'express';

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean;
  message?: string;
}

export function validateInput(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field] ?? req.query[rule.field] ?? req.params[rule.field];

      // Required check
      if (rule.required && (value === undefined || value === null)) {
        errors.push(rule.message || `${rule.field} is required`);
        continue;
      }

      // Skip further checks if not present and not required
      if (value === undefined || value === null) continue;

      // Type check
      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(rule.message || `${rule.field} must be a string`);
        continue;
      }
      if (rule.type === 'number' && typeof value !== 'number') {
        errors.push(rule.message || `${rule.field} must be a number`);
        continue;
      }
      if (rule.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(rule.message || `${rule.field} must be a boolean`);
        continue;
      }
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push(rule.message || `${rule.field} must be an array`);
        continue;
      }
      if (rule.type === 'object' && (typeof value !== 'object' || Array.isArray(value))) {
        errors.push(rule.message || `${rule.field} must be an object`);
        continue;
      }

      // String length checks
      if (rule.type === 'string' && typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          errors.push(rule.message || `${rule.field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          errors.push(rule.message || `${rule.field} must be at most ${rule.maxLength} characters`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(rule.message || `${rule.field} format is invalid`);
        }
      }

      // Number range checks
      if (rule.type === 'number' && typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(rule.message || `${rule.field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(rule.message || `${rule.field} must be at most ${rule.max}`);
        }
      }

      // Custom validation
      if (rule.custom && !rule.custom(value)) {
        errors.push(rule.message || `${rule.field} is invalid`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

// Sanitize string input by removing potentially dangerous characters
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

// Validate and sanitize objective string
export function validateObjective(objive: unknown): string | null {
  if (typeof objive !== 'string') return null;
  const sanitized = sanitizeString(objive).trim();
  if (sanitized.length === 0 || sanitized.length > 10000) return null;
  return sanitized;
}

// Validate run ID format
export function validateRunId(runId: unknown): boolean {
  return typeof runId === 'string' && /^[\w-]{1,128}$/.test(runId);
}
