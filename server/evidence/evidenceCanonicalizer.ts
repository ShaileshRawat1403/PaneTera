import { createHash } from 'crypto';
import { EvidenceItem } from './evidenceTypes';
import { ContentIntegrity } from '../research/researchTypes';

export function normalizeNewlines(str: string): string {
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function toCanonicalEvidenceText(item: EvidenceItem): string {
  const content = normalizeNewlines(item.content);
  
  switch (item.kind) {
    case 'text':
      return content;
      
    case 'heading': {
      const level = item.locator?.level || 'unknown';
      return `${level}\n${content}`;
    }
      
    case 'table-cell': {
      const row = item.locator?.row ?? 'unknown';
      const col = item.locator?.column ?? 'unknown';
      return `${row}\n${col}\n${content}`;
    }
      
    case 'link': {
      const href = item.locator?.href || 'unknown';
      return `${content}\n${href}`;
    }
      
    case 'code': {
      const language = item.locator?.language || 'unknown';
      return `${language}\n${content}`;
    }

    case 'metadata':
      return content;
      
    default:
      throw new Error(`Unsupported evidence kind: ${item.kind}`);
  }
}

export function hashCanonicalText(canonicalText: string): ContentIntegrity {
  const buffer = Buffer.from(canonicalText, 'utf8');
  const hash = createHash('sha256').update(buffer).digest('hex');
  
  return {
    hashAlgorithm: 'sha256',
    canonicalizationVersion: 'text-v1',
    contentHash: hash,
    contentBytes: buffer.length
  };
}
