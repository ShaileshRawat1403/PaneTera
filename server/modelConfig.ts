export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash';

export function geminiModelName(configured: string | undefined): string {
  const model = configured?.trim() || DEFAULT_GEMINI_MODEL;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)) {
    throw new Error('GEMINI_MODEL contains unsupported characters.');
  }
  return model;
}

export function geminiGenerateContentUrl(configured: string | undefined): string {
  return `https://generativelanguage.googleapis.com/v1/models/${geminiModelName(configured)}:generateContent`;
}
