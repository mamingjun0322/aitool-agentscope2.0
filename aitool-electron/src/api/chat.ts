import type { AgentEvent } from '../types'

export function parseSSEChunk(chunk: string): AgentEvent[] {
  const events: AgentEvent[] = []
  const lines = chunk.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('data:')) {
      const jsonStr = trimmed.slice(5).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue
      try {
        const parsed = JSON.parse(jsonStr) as AgentEvent
        events.push(parsed)
      } catch {
        // skip malformed lines
      }
    }
  }
  return events
}

export interface StreamChatOptions {
  content: string
  sessionId: string
  userId: string
  baseUrl: string
  onEvent: (event: AgentEvent) => void
  onError: (error: string) => void
  onDone: () => void
  signal?: AbortSignal
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { content, sessionId, userId, baseUrl, onEvent, onError, onDone, signal } = options

  try {
    const response = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, sessionId, userId }),
      signal,
    })

    if (!response.ok) {
      const text = await response.text()
      onError(`HTTP ${response.status}: ${text}`)
      return
    }

    if (!response.body) {
      onError('Response body is null')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      const events = parseSSEChunk(chunk)
      for (const event of events) {
        onEvent(event)
      }
    }

    onDone()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onDone()
      return
    }
    onError(err instanceof Error ? err.message : '请求失败')
  }
}

export async function checkHealth(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { method: 'GET' })
    return response.ok
  } catch {
    return false
  }
}

export async function interruptChat(
  baseUrl: string,
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    await fetch(`${baseUrl}/api/chat/interrupt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId }),
    })
  } catch {
    // ignore interrupt errors
  }
}
