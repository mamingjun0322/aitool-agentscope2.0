import { FC, useState } from 'react'
import { clsx } from 'clsx'
import type { ToolCall } from '../../types'

interface ToolCallCardProps {
  toolCall: ToolCall
}

const statusColors = {
  pending: 'text-yellow-500 dark:text-yellow-400',
  running: 'text-blue-500 dark:text-blue-400 animate-pulse',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
}

const statusLabels = {
  pending: '等待中',
  running: '执行中...',
  success: '完成',
  error: '失败',
}

const ToolCallCard: FC<ToolCallCardProps> = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="my-2 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50 dark:bg-green-950/20">
      <div className="flex items-center gap-2 px-3 py-2">
        <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs font-mono font-medium text-green-700 dark:text-green-300 flex-1 truncate">
          {toolCall.name}
        </span>
        <span className={clsx('text-xs', statusColors[toolCall.status])}>
          {statusLabels[toolCall.status]}
        </span>
        {toolCall.result && (
          <button
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '收起' : '展开'}
          </button>
        )}
      </div>
      {expanded && toolCall.result && (
        <div className="px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900/50 border-t border-green-200 dark:border-green-800 font-mono text-gray-600 dark:text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {toolCall.result}
        </div>
      )}
    </div>
  )
}

export default ToolCallCard
