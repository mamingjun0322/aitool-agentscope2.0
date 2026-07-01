import { FC } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

interface MarkdownContentProps {
  content: string
  isStreaming?: boolean
}

const MarkdownContent: FC<MarkdownContentProps> = ({ content, isStreaming }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
    <ReactMarkdown
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: ({ className, children, ...props }) => {
          const isBlock = className?.startsWith('language-')
          if (isBlock) {
            return (
              <code className={`${className} text-xs`} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
              {children}
            </code>
          )
        },
        pre: ({ children }) => (
          <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto text-xs my-2">
            {children}
          </pre>
        ),
      }}
    >
      {content + (isStreaming ? '' : '')}
    </ReactMarkdown>
    {isStreaming && (
      <span className="inline-block w-0.5 h-4 bg-gray-500 dark:bg-gray-400 ml-0.5 animate-cursor-blink align-text-bottom" />
    )}
  </div>
)

export default MarkdownContent
