import { describe, it, expect } from 'vitest'
import { redactContent, getRedactionPatterns } from './redaction.js'

describe('redaction', () => {
  it('should redact email addresses', () => {
    const content = 'Contact me at user@example.com for more info'
    const result = redactContent(content)

    expect(result.content).toContain('[REDACTED_EMAIL]')
    expect(result.content).not.toContain('user@example.com')
    expect(result.redactions).toContainEqual({ type: 'email', count: 1 })
  })

  it('should redact API keys', () => {
    const content = 'api_key = "test_api_key_value_1234567890"'
    const result = redactContent(content)

    expect(result.content).toContain('[REDACTED_API_KEY]')
    expect(result.redactions).toContainEqual({ type: 'api_key', count: 1 })
  })

  it('should redact tokens', () => {
    const content = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
    const result = redactContent(content)

    expect(result.content).toContain('[REDACTED_TOKEN]')
    expect(result.redactions).toContainEqual({ type: 'token', count: 1 })
  })

  it('should redact AWS keys', () => {
    const content = 'AWS_ACCESS_KEY = EXAMPLEAWSKEY1234567890'
    const result = redactContent(content)

    expect(result.content).toContain('[REDACTED_AWS_KEY]')
    expect(result.redactions).toContainEqual({ type: 'aws_key', count: 1 })
  })

  it('should redact passwords', () => {
    const content = 'password = "SuperSecretPassword123!"'
    const result = redactContent(content)

    expect(result.content).toContain('[REDACTED_PASSWORD]')
    expect(result.redactions).toContainEqual({ type: 'password', count: 1 })
  })

  it('should redact multiple sensitive items', () => {
    const content = `
      Email: admin@example.com
      API Key: api_key = "test_api_key_value_1234567890"
      Password: password = "MySecretPass"
    `
    const result = redactContent(content)

    expect(result.redactions.length).toBeGreaterThan(0)
    expect(result.content).not.toContain('admin@example.com')
  })

  it('should not redact non-sensitive content', () => {
    const content = 'This is a regular memory about TypeScript and React.'
    const result = redactContent(content)

    expect(result.content).toBe(content)
    expect(result.redactions).toEqual([])
  })

  it('should return redaction patterns', () => {
    const patterns = getRedactionPatterns()

    expect(patterns.length).toBeGreaterThan(0)
    expect(patterns.find((p) => p.name === 'email')).toBeDefined()
    expect(patterns.find((p) => p.name === 'api_key')).toBeDefined()
  })
})
