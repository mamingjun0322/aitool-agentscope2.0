import { FC, useState } from 'react'
import { clsx } from 'clsx'

interface ThinkingBlockProps {
  text: string
  collapsed: boolean
}

const ThinkingBlock: FC<ThinkingBlockProps> = ({ text, collapsed: initCollapsed }) => {
  const [collapsed, setCollapsed] = useState(initCollapsed)

  return (
    <div className="mb-2 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          className={clsx('w-3 h-3 transition-transform', !collapsed && 'rotate-90')}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
        <span>思考过程</span>
      </button>
      {!collapsed && (
        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/30 whitespace-pre-wrap leading-relaxed">
          {text}
        </div>
      )}
    </div>
  )
}

export default ThinkingBlock
