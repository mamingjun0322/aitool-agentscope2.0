export type AgentEventType =
  | 'TEXT_BLOCK_DELTA'
  | 'THINKING_BLOCK_DELTA'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_END'
  | 'TOOL_RESULT_TEXT_DELTA'
  | 'MODEL_CALL_START'
  | 'MODEL_CALL_END'
  | 'AGENT_START'
  | 'AGENT_END'
  | 'ERROR'

export interface AgentEvent {
  type: AgentEventType
  delta?: string
  toolCallName?: string
  toolCallId?: string
  toolInput?: string
  toolResult?: string
  error?: string
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result?: string
  status: 'pending' | 'running' | 'success' | 'error'
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string; collapsed: boolean }
  | { type: 'tool_call'; toolCall: ToolCall }

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: ContentBlock[]
  createdAt: number
  isStreaming?: boolean
  isModelThinking?: boolean
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  userId: string
}

export interface ChatRequest {
  content: string
  sessionId: string
  userId: string
}
