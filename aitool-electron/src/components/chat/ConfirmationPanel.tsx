import type { PendingConfirmation } from '../../types'

interface ConfirmationPanelProps {
  confirmation: PendingConfirmation
  isSubmitting: boolean
  onDecision: (approved: boolean) => void
}

export function ConfirmationPanel({
  confirmation,
  isSubmitting,
  onDecision,
}: ConfirmationPanelProps) {
  return (
    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
          !
        </div>
        <div>
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">需要你的确认</p>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Agent 请求执行以下受控工具
          </p>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        {confirmation.toolCalls.map((toolCall) => (
          <div
            key={toolCall.id}
            className="rounded-lg border border-amber-200/80 bg-white/80 p-2 dark:border-amber-800/80 dark:bg-gray-900/60"
          >
            <p className="font-mono text-xs font-medium text-gray-800 dark:text-gray-100">
              {toolCall.name}
            </p>
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all text-[11px] text-gray-500 dark:text-gray-400">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onDecision(false)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          拒绝
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onDecision(true)}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          批准并继续
        </button>
      </div>
    </div>
  )
}
