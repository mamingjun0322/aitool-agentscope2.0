import { FC, useState } from 'react'
import { clsx } from 'clsx'
import type { Message } from '../../types'
import ThinkingBlock from './ThinkingBlock'
import ToolCallCard from './ToolCallCard'
import MarkdownContent from './MarkdownContent'

interface MessageBubbleProps {
  message: Message
}

const UserBubble: FC<{ text: string }> = ({ text }) => (
  <div className="flex justify-end mb-4">
    <div className="max-w-[75%] bg-blue-500 dark:bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
      {text}
    </div>
  </div>
)

const AssistantBubble: FC<{ message: Message }> = ({ message }) => {
  const [copied, setCopied] = useState(false)

  const fullText = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="flex gap-2 mb-4 items-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs shrink-0 mt-0.5">
        AI
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
          {message.content.length === 0 && message.isStreaming && !message.isModelThinking && (
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
          {message.isModelThinking && (
            <div className="flex items-center gap-2 text-sm text-purple-500 dark:text-purple-400">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span className="animate-pulse">模型思考中...</span>
            </div>
          )}
          {message.content.map((block, i) => {
            if (block.type === 'thinking') {
              return <ThinkingBlock key={i} text={block.text} collapsed={block.collapsed} />
            }
            if (block.type === 'tool_call') {
              return <ToolCallCard key={i} toolCall={block.toolCall} />
            }
            if (block.type === 'text') {
              const isLastBlock = i === message.content.length - 1
              return (
                <MarkdownContent
                  key={i}
                  content={block.text}
                  isStreaming={message.isStreaming && isLastBlock}
                />
              )
            }
            return null
          })}
        </div>
        {!message.isStreaming && fullText && (
          <div className="flex items-center gap-2 mt-1 px-1">
            <button
              onClick={copyToClipboard}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors"
              title="复制"
            >
              {copied ? (
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const MessageBubble: FC<MessageBubbleProps> = ({ message }) => {
  if (message.role === 'user') {
    const text = message.content.find((b) => b.type === 'text')
    return <UserBubble text={text?.type === 'text' ? text.text : ''} />
  }
  if (message.role === 'assistant') {
    return <AssistantBubble message={message} />
  }
  return (
    <div className="text-center text-xs text-gray-400 dark:text-gray-500 my-2">{
      message.content.find((b) => b.type === 'text')?.type === 'text'
        ? (message.content.find((b) => b.type === 'text') as { type: 'text'; text: string }).text
        : ''
    }</div>
  )
}

export default MessageBubble
