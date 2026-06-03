import { BaseLLMClient, type ChatOptions } from './client.js'

/**
 * Test-only `LLMClient`. Programmable: queue up responses with
 * `setChatResponses` and they will be returned in order from `chat()`.
 *
 * Every call is recorded in `calls()` for assertions.
 */
export class MockLLMClient extends BaseLLMClient {
  private chatResponses: string[] = []
  private readonly callLog: ChatOptions[] = []

  /** Queue responses, consumed in order by subsequent `chat` calls. */
  setChatResponses(...responses: string[]): void {
    this.chatResponses = [...responses]
  }

  override async chat(opts: ChatOptions): Promise<string> {
    this.callLog.push(opts)
    const response = this.chatResponses.shift()
    if (response === undefined) {
      throw new Error('MockLLMClient: no chat response programmed for this call.')
    }
    return response
  }

  /** All `chat` calls recorded in order. */
  calls(): ReadonlyArray<ChatOptions> {
    return this.callLog
  }

  /** Reset both the response queue and the call log. */
  reset(): void {
    this.chatResponses = []
    this.callLog.length = 0
  }
}
