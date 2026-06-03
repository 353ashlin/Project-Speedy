import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { MockLLMClient } from './mock.js'

describe('MockLLMClient', () => {
  let client: MockLLMClient

  beforeEach(() => {
    client = new MockLLMClient()
  })

  describe('chat', () => {
    it('returns queued responses in order', async () => {
      client.setChatResponses('one', 'two', 'three')
      expect(
        await client.chat({ messages: [{ role: 'user', content: 'a' }], model: 'haiku' }),
      ).toBe('one')
      expect(
        await client.chat({ messages: [{ role: 'user', content: 'b' }], model: 'haiku' }),
      ).toBe('two')
      expect(
        await client.chat({ messages: [{ role: 'user', content: 'c' }], model: 'haiku' }),
      ).toBe('three')
    })

    it('throws when no responses are queued', async () => {
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'a' }], model: 'haiku' }),
      ).rejects.toThrow(/no chat response programmed/)
    })

    it('records every call', async () => {
      client.setChatResponses('ok')
      await client.chat({ messages: [{ role: 'user', content: 'hi' }], model: 'sonnet' })
      expect(client.calls()).toHaveLength(1)
      expect(client.calls()[0]?.messages[0]?.content).toBe('hi')
      expect(client.calls()[0]?.model).toBe('sonnet')
    })
  })

  describe('extractJSON', () => {
    const schema = z.object({ count: z.number(), name: z.string() })

    it('parses valid JSON on first try', async () => {
      client.setChatResponses('{"count": 7, "name": "Joe"}')
      const result = await client.extractJSON({
        prompt: 'give me joe',
        schema,
        model: 'haiku',
      })
      expect(result).toEqual({ count: 7, name: 'Joe' })
      expect(client.calls()).toHaveLength(1)
    })

    it('appends the JSON-only instruction to the system prompt', async () => {
      client.setChatResponses('{"count": 1, "name": "x"}')
      await client.extractJSON({
        system: 'You are a helpful extractor.',
        prompt: 'go',
        schema,
        model: 'haiku',
      })
      const sys = client.calls()[0]?.system ?? ''
      expect(sys).toContain('You are a helpful extractor.')
      expect(sys).toContain('Respond with ONLY a single JSON value')
    })

    it('retries once on invalid JSON', async () => {
      client.setChatResponses('not json at all', '{"count": 5, "name": "Joe"}')
      const result = await client.extractJSON({ prompt: 'go', schema, model: 'haiku' })
      expect(result).toEqual({ count: 5, name: 'Joe' })
      expect(client.calls()).toHaveLength(2)
    })

    it('retries once on schema validation failure', async () => {
      // First response parses as JSON but fails schema (missing `count`).
      client.setChatResponses('{"name": "Joe"}', '{"count": 5, "name": "Joe"}')
      const result = await client.extractJSON({ prompt: 'go', schema, model: 'haiku' })
      expect(result).toEqual({ count: 5, name: 'Joe' })
      expect(client.calls()).toHaveLength(2)
    })

    it('throws after two failed attempts', async () => {
      client.setChatResponses('bad', 'still bad')
      await expect(client.extractJSON({ prompt: 'go', schema, model: 'haiku' })).rejects.toThrow(
        /extractJSON failed after retry/,
      )
      expect(client.calls()).toHaveLength(2)
    })

    it('strips whitespace from the raw response before parsing', async () => {
      client.setChatResponses('   {"count": 1, "name": "x"}   \n')
      const result = await client.extractJSON({ prompt: 'go', schema, model: 'haiku' })
      expect(result).toEqual({ count: 1, name: 'x' })
    })
  })

  describe('reset', () => {
    it('clears both queue and call log', async () => {
      client.setChatResponses('a')
      await client.chat({ messages: [{ role: 'user', content: 'x' }], model: 'haiku' })
      client.reset()
      expect(client.calls()).toHaveLength(0)
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'x' }], model: 'haiku' }),
      ).rejects.toThrow(/no chat response programmed/)
    })
  })
})
