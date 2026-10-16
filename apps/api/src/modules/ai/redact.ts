import crypto from 'node:crypto';

export function redactText(input: string): { readonly text: string; readonly changed: boolean } {
  const SENSITIVE_PATTERNS: readonly RegExp[] = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /\b\+?\d[\d\s\-()]{7,}\d\b/g,
    /\b\d{2,}-\d{2}-\d{6}[A-Z]?\b/gi,
    /\b\d{9,12}\b/g,
  ];
  let result = input;
  let changed = false;
  for (const pattern of SENSITIVE_PATTERNS) {
    const before = result;
    result = result.replace(pattern, '[redacted]');
    if (result !== before) {
      changed = true;
    }
    pattern.lastIndex = 0;
  }
  return { text: result, changed };
}

export function hashText(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}
