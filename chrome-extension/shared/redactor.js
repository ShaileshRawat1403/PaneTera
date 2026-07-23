// chrome-extension/shared/redactor.js

function isLuhnValid(numberStr) {
  const digits = numberStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return (sum % 10) === 0;
}

export function sanitizeUrl(urlString) {
  if (typeof urlString !== 'string' || !urlString.trim()) return '';
  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    // Strip userinfo credentials
    parsed.username = '';
    parsed.password = '';

    // Redact sensitive query parameter values
    const sensitiveKeys = ['token', 'key', 'auth', 'api_key', 'apikey', 'secret', 'password', 'passwd', 'session', 'access_token', 'refresh_token'];
    for (const [paramKey, paramVal] of Array.from(parsed.searchParams.entries())) {
      if (sensitiveKeys.some(k => paramKey.toLowerCase().includes(k))) {
        parsed.searchParams.set(paramKey, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch (e) {
    return '';
  }
}

export function redactText(text) {
  if (typeof text !== 'string') {
    return {
      redactedText: '',
      redactions: { credentials: 0, emails: 0, creditCards: 0, phoneNumbers: 0, ssnLike: 0, truncated: false },
      disclaimer: 'PII detection is bounded and best-effort; completeness is not guaranteed.'
    };
  }

  // DoS string length bound
  let isTruncated = false;
  let boundedText = text;
  if (text.length > 100000) {
    boundedText = text.substring(0, 100000) + '... [TRUNCATED_MAX_LENGTH]';
    isTruncated = true;
  }

  const redactions = {
    credentials: 0,
    emails: 0,
    creditCards: 0,
    phoneNumbers: 0,
    ssnLike: 0,
    truncated: isTruncated
  };

  let cleaned = boundedText;

  // 1. High-confidence credentials
  const credentialPatterns = [
    /sk-[A-Za-z0-9_-]{20,}/g,
    /ghp_[A-Za-z0-9_-]{20,}/g,
    /gho_[A-Za-z0-9_-]{20,}/g,
    /glpat-[A-Za-z0-9_-]{20,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /xox[baprs]-[A-Za-z0-9_-]{10,}/g,
    /Bearer\s+[A-Za-z0-9._-]{20,}/g,
    /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    /(postgres|mongodb|mysql|redis):\/\/[^\s@]+@[^\s]+/g
  ];

  credentialPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, () => {
      redactions.credentials++;
      return '[REDACTED_CREDENTIAL]';
    });
  });

  // 2. Email addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  cleaned = cleaned.replace(emailRegex, () => {
    redactions.emails++;
    return '[REDACTED_EMAIL]';
  });

  // 3. SSNs
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  cleaned = cleaned.replace(ssnRegex, () => {
    redactions.ssnLike++;
    return '[REDACTED_SSN]';
  });

  // 4. Phone numbers
  const phoneRegex = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
  cleaned = cleaned.replace(phoneRegex, () => {
    redactions.phoneNumbers++;
    return '[REDACTED_PHONE]';
  });

  // 5. Credit Cards with Luhn verification
  const cardCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  cleaned = cleaned.replace(cardCandidateRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (isLuhnValid(digitsOnly)) {
      redactions.creditCards++;
      return '[REDACTED_CARD]';
    }
    return match;
  });

  return {
    redactedText: cleaned,
    redactions,
    disclaimer: 'PII detection is bounded and best-effort; completeness is not guaranteed.'
  };
}

export function redactObject(obj, currentDepth = 0) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (currentDepth > 5) {
    return '[TRUNCATED_MAX_DEPTH]';
  }

  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return sanitizeUrl(trimmed);
    }
    return redactText(obj).redactedText;
  }

  if (Array.isArray(obj)) {
    const boundedArray = obj.slice(0, 100);
    return boundedArray.map(item => redactObject(item, currentDepth + 1));
  }

  if (typeof obj === 'object') {
    const result = {};
    const keys = Object.keys(obj).slice(0, 100);
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      result[key] = redactObject(obj[key], currentDepth + 1);
    }
    return result;
  }

  return obj;
}
