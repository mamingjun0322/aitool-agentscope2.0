import type { AgentEvent, ConfirmationToolCall } from '../types'

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

export interface ConfirmChatOptions extends Omit<StreamChatOptions, 'content'> {
  approved: boolean
  toolCalls: ConfirmationToolCall[]
  message?: string
}

interface StreamRequestOptions
  extends Omit<StreamChatOptions, 'content' | 'sessionId' | 'userId'> {
  path: string
  body: Record<string, unknown>
}

async function streamRequest(options: StreamRequestOptions): Promise<void> {
  const { path, body, baseUrl, onEvent, onError, onDone, signal } = options

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.replace(/\r\n/g, '\n').split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        for (const event of parseSSEChunk(frame)) {
          onEvent(event)
        }
      }
    }

    buffer += decoder.decode()
    for (const event of parseSSEChunk(buffer)) {
      onEvent(event)
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

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const { content, sessionId, userId, ...streamOptions } = options
  return streamRequest({
    ...streamOptions,
    path: '/api/chat/stream',
    body: { content, sessionId, userId },
  })
}

export async function confirmChat(options: ConfirmChatOptions): Promise<void> {
  const { sessionId, userId, approved, message, toolCalls, ...streamOptions } = options
  return streamRequest({
    ...streamOptions,
    path: '/api/chat/confirm',
    body: { sessionId, userId, approved, message, toolCalls },
  })
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
