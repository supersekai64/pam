const REDACTION_PATTERNS = [
  {
    name: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    name: 'api_key',
    regex: /\b(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
    replacement: '[REDACTED_API_KEY]',
  },
  {
    name: 'token',
    regex: /\b(token|bearer|authorization)\s*[:=]?\s*['"]?[A-Za-z0-9_.-]{20,}['"]?/gi,
    replacement: '[REDACTED_TOKEN]',
  },
  {
    name: 'aws_key',
    regex:
      /\b(AWS_ACCESS_KEY_ID|AWS_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}['"]?|\bAKIA[0-9A-Z]{16}\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  {
    name: 'private_key',
    regex:
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
  {
    name: 'password',
    regex: /\b(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi,
    replacement: '[REDACTED_PASSWORD]',
  },
  {
    name: 'secret',
    regex: /\b(secret|client[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}['"]?/gi,
    replacement: '[REDACTED_SECRET]',
  },
]

export interface RedactionResult {
  content: string
  redactions: Array<{
    type: string
    count: number
  }>
}

export function redactContent(content: string): RedactionResult {
  let redacted = content
  const redactions: Array<{ type: string; count: number }> = []

  for (const pattern of REDACTION_PATTERNS) {
    const matches = redacted.match(pattern.regex)
    if (matches && matches.length > 0) {
      redactions.push({
        type: pattern.name,
        count: matches.length,
      })
      redacted = redacted.replace(pattern.regex, pattern.replacement)
    }
  }

  return {
    content: redacted,
    redactions,
  }
}

export function getRedactionPatterns() {
  return REDACTION_PATTERNS.map((p) => ({
    name: p.name,
    pattern: p.regex.source,
  }))
}
