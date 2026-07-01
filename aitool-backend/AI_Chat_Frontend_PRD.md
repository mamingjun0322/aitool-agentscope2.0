# AI 问数前端项目 PRD

**项目名称**：agentscope-chat-ui
**版本**：v1.0.0
**后端**：AgentScope_java（Spring Boot + AgentScope 2.0 Harness）
**前端技术栈**：React 18 + TypeScript + Vite + Tailwind CSS
**文档日期**：2026-07-01

---

## 一、项目背景与目标

### 背景

后端 `AgentScope_java` 项目基于 AgentScope 2.0 Java SDK，已实现：
- `HarnessAgent` 驱动的 ReAct 推理-行动循环
- DeepSeek（兼容 OpenAI 协议）大模型接入
- 流式事件输出（`streamEvents`）
- 会话持久化（`sessionId` + `userId`）
- 对话压缩（triggerMessages=30，keepMessages=10）

当前后端以 `main()` 方法直接运行，**缺少 HTTP 接口层和前端交互界面**。本项目目标是：
1. 后端补充 REST + SSE 接口
2. 前端实现对话式 AI 问数页面，接入后端流式事件

### 目标

| 目标 | 说明 |
|------|------|
| 用户友好 | 提供类 ChatGPT 的对话界面，支持流式打字机效果 |
| 实时反馈 | 展示 Agent 思考过程、工具调用状态 |
| 多会话 | 支持多个对话 Session 切换管理 |
| 可扩展 | 为后续接入 RAG 知识库、工具面板预留扩展点 |

---

## 二、用户角色

| 角色 | 描述 |
|------|------|
| 普通用户 | 通过前端页面与 AI Agent 进行对话问答 |
| 开发者 | 通过 API 直接调用后端接口（非本 PRD 范围） |

---

## 三、功能需求

### 3.1 核心功能

#### F1 - 对话输入与发送

- **描述**：用户在底部输入框输入问题，点击发送或按 `Enter` 键提交
- **支持**：
  - `Shift + Enter` 换行
  - 发送中禁用输入框和按钮，显示加载状态
  - 空内容不允许发送

#### F2 - 流式消息展示（打字机效果）

- **描述**：AI 回答以流式逐字展示，模拟打字机效果
- **事件类型映射**：

| AgentScope 事件 | 前端展示 |
|----------------|----------|
| `TEXT_BLOCK_DELTA` | 逐字追加到消息气泡 |
| `THINKING_BLOCK_DELTA` | 折叠的"思考过程"展示（灰色斜体） |
| `TOOL_CALL_START` | 显示工具调用 Badge（工具名 + 动画） |
| `TOOL_RESULT_TEXT_DELTA` | 工具结果展示（代码块风格） |
| `MODEL_CALL_START` | 显示"思考中..."状态 |
| `AGENT_END` | 消息完成，停止光标闪烁 |

#### F3 - 会话（Session）管理

- **描述**：左侧侧边栏管理多个会话
- **功能**：
  - 新建对话（自动生成 sessionId）
  - 切换会话（加载历史消息）
  - 删除会话
  - 会话列表显示：标题（取第一条用户消息前 20 字）+ 时间

#### F4 - 消息历史展示

- **描述**：右侧主区域展示当前会话的所有消息
- **消息类型**：
  - 用户消息（右对齐，蓝色气泡）
  - AI 消息（左对齐，白色气泡）
  - 系统消息（居中，灰色，如"新会话开始"）

#### F5 - Markdown 渲染

- **描述**：AI 回答支持 Markdown 格式渲染
- **支持语法**：标题、粗体、斜体、代码块（含语法高亮）、列表、表格、链接

#### F6 - 工具调用可视化

- **描述**：当 Agent 调用工具时，在消息中展示工具调用卡片
- **展示内容**：
  - 工具名称 + 图标
  - 调用参数（可折叠展开）
  - 执行状态（进行中 / 成功 / 失败）
  - 执行结果（可折叠展开）

#### F7 - 思考过程展示

- **描述**：支持 DeepSeek R1 等推理模型的思考过程展示
- **交互**：默认折叠，点击"查看思考过程"可展开，灰色斜体样式

#### F8 - 停止生成

- **描述**：AI 回答生成中，用户可点击"停止"按钮中断生成
- **行为**：调用后端 interrupt 接口，前端立即停止 SSE 接收

### 3.2 辅助功能

#### F9 - 消息操作

- 复制消息内容（点击复制图标）
- 重新生成（对最后一条 AI 消息）

#### F10 - 主题切换

- 支持亮色 / 暗色模式切换
- 默认跟随系统主题

#### F11 - 页面标题 / 顶部栏

- 项目名称："AI 智能问答"
- 当前模型显示：`DeepSeek V4 Flash`
- 主题切换按钮

---

## 四、非功能需求

| 类别 | 要求 |
|------|------|
| **性能** | 首屏加载 < 2s；流式消息渲染无卡顿（60fps） |
| **兼容性** | 支持 Chrome 90+、Edge 90+、Firefox 88+ |
| **响应式** | 支持桌面端（1280px+）和平板端（768px+） |
| **错误处理** | 网络断开、后端报错均有友好提示和重试机制 |
| **安全** | 不在前端存储 API Key；SessionId 本地持久化 |

---

## 五、页面设计

### 5.1 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  顶部导航栏（Header）                                     │
│  [AI 智能问答]              [DeepSeek V4 Flash] [🌙/☀️] │
├───────────────┬─────────────────────────────────────────┤
│               │                                         │
│  侧边栏        │  消息区域（主内容区）                    │
│  (Sidebar)    │                                         │
│               │  ┌─────────────────────────────────┐   │
│  [+ 新建对话] │  │  用户消息气泡（右对齐）           │   │
│               │  └─────────────────────────────────┘   │
│  会话列表：    │                                         │
│  > 关于RAG的  │  ┌─────────────────────────────────┐   │
│    问题       │  │  🤖 AI 消息气泡（左对齐）         │   │
│  > 技术分享   │  │  ╔══════════════════╗           │   │
│    内容       │  │  ║ 思考过程（折叠）  ║           │   │
│  > 产品功能   │  │  ╚══════════════════╝           │   │
│    咨询       │  │  [🔧 调用工具: search] ←Badge   │   │
│               │  │  正文回答内容...                 │   │
│               │  └─────────────────────────────────┘   │
│               │                                         │
│               ├─────────────────────────────────────────┤
│               │  输入区域（Footer）                      │
│               │  ┌──────────────────────────────┐[发送]│
│               │  │  请输入您的问题...             │      │
│               │  └──────────────────────────────┘      │
│               │  [停止生成] ← 生成中显示                 │
└───────────────┴─────────────────────────────────────────┘
```

### 5.2 消息气泡设计

**用户消息：**
```
                    ┌──────────────────────────┐
                    │  我想了解 RAG 是什么？    │
                    └──────────────────────────┘ 👤
```

**AI 消息（流式 + 工具调用）：**
```
🤖 ┌─────────────────────────────────────────┐
   │ ▶ 思考过程（点击展开）                   │  ← 折叠
   │                                         │
   │ ┌─ 🔧 正在调用工具 ──────────────────┐  │
   │ │  search_knowledge                   │  │  ← 工具 Badge
   │ │  参数: {"query": "RAG 定义"}  [展开]│  │
   │ └───────────────────────────────────┘  │
   │                                         │
   │ RAG（检索增强生成）是一种将**检索系统**  │  ← Markdown
   │ 与**大语言模型**结合的技术...           │
   │                                         │
   │ [📋 复制] [🔄 重新生成]                │  ← 操作按钮
   └─────────────────────────────────────────┘
```

### 5.3 颜色规范

| 元素 | 亮色模式 | 暗色模式 |
|------|----------|----------|
| 背景 | `#F9FAFB` | `#1A1A2E` |
| 侧边栏 | `#FFFFFF` | `#16213E` |
| 用户气泡 | `#3B82F6`（蓝色） | `#2563EB` |
| AI 气泡 | `#FFFFFF` | `#0F3460` |
| 工具 Badge | `#F0FDF4` + `#15803D` border | `#052E16` + `#4ADE80` border |
| 思考块 | `#F3F4F6`（灰色）斜体 | `#1F2937` |
| 文字主色 | `#111827` | `#F9FAFB` |
| 文字次色 | `#6B7280` | `#9CA3AF` |
| 强调色 | `#3B82F6` | `#60A5FA` |

---

## 六、技术方案

### 6.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 样式框架 |
| Zustand | 4.x | 状态管理 |
| React Markdown | 9.x | Markdown 渲染 |
| rehype-highlight | 7.x | 代码语法高亮 |
| uuid | 9.x | 生成 sessionId |
| clsx | 2.x | 条件 className |

### 6.2 项目目录结构

```
agentscope-chat-ui/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                    # API 层
│   │   ├── chat.ts             # 聊天相关 API（SSE）
│   │   └── types.ts            # API 类型定义
│   ├── components/             # 组件层
│   │   ├── layout/
│   │   │   ├── Header.tsx      # 顶部导航
│   │   │   ├── Sidebar.tsx     # 侧边栏（会话列表）
│   │   │   └── Layout.tsx      # 整体布局
│   │   ├── chat/
│   │   │   ├── MessageList.tsx      # 消息列表
│   │   │   ├── MessageBubble.tsx    # 消息气泡
│   │   │   ├── UserMessage.tsx      # 用户消息
│   │   │   ├── AssistantMessage.tsx # AI 消息
│   │   │   ├── ThinkingBlock.tsx    # 思考过程折叠块
│   │   │   ├── ToolCallCard.tsx     # 工具调用卡片
│   │   │   ├── MarkdownContent.tsx  # Markdown 渲染
│   │   │   └── TypingCursor.tsx     # 打字机光标
│   │   ├── input/
│   │   │   ├── ChatInput.tsx        # 输入框
│   │   │   └── SendButton.tsx       # 发送按钮
│   │   └── ui/                 # 通用 UI 组件
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── Spinner.tsx
│   │       └── Toast.tsx
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useChat.ts          # 聊天核心逻辑（SSE 处理）
│   │   ├── useSession.ts       # 会话管理
│   │   └── useTheme.ts         # 主题切换
│   ├── store/                  # 状态管理（Zustand）
│   │   ├── chatStore.ts        # 消息、会话状态
│   │   └── settingStore.ts     # 用户设置
│   ├── types/                  # 类型定义
│   │   ├── message.ts          # 消息类型
│   │   ├── session.ts          # 会话类型
│   │   └── event.ts            # AgentScope 事件类型
│   ├── utils/                  # 工具函数
│   │   ├── sse.ts              # SSE 解析工具
│   │   ├── storage.ts          # LocalStorage 封装
│   │   └── format.ts           # 格式化工具
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 6.3 核心数据类型

```typescript
// types/message.ts

// AgentScope 事件类型
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
  | 'ERROR';

// SSE 事件数据
export interface AgentEvent {
  type: AgentEventType;
  delta?: string;         // TEXT_BLOCK_DELTA / THINKING_BLOCK_DELTA
  toolCallName?: string;  // TOOL_CALL_START
  toolCallId?: string;
  toolInput?: string;
  toolResult?: string;
  error?: string;
}

// 工具调用状态
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  status: 'pending' | 'running' | 'success' | 'error';
}

// 消息内容块
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string; collapsed: boolean }
  | { type: 'tool_call'; toolCall: ToolCall };

// 消息
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  createdAt: number;
  isStreaming?: boolean;  // 是否正在流式输出
}

// 会话
export interface Session {
  id: string;           // sessionId，同步到后端
  title: string;        // 取第一条用户消息前 20 字
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  userId: string;
}
```

### 6.4 SSE 对接方案

后端通过 SSE 推送 AgentScope 事件，前端使用 `fetch` + `ReadableStream` 消费：

```typescript
// hooks/useChat.ts 核心逻辑（伪代码）

async function sendMessage(content: string, sessionId: string) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, sessionId, userId: 'user-001' }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // 解析 SSE 格式：data: {...}\n\n
    const events = parseSSEChunk(chunk);

    for (const event of events) {
      dispatch(event);  // 分发到 Zustand store
    }
  }
}
```

### 6.5 状态管理设计（Zustand）

```typescript
// store/chatStore.ts 结构

interface ChatStore {
  // 状态
  sessions: Session[];
  currentSessionId: string | null;
  isStreaming: boolean;
  error: string | null;

  // 计算属性
  currentSession: Session | null;
  currentMessages: Message[];

  // 操作
  createSession: () => Session;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;

  addUserMessage: (content: string) => Message;
  appendTextDelta: (sessionId: string, msgId: string, delta: string) => void;
  appendThinkingDelta: (sessionId: string, msgId: string, delta: string) => void;
  addToolCall: (sessionId: string, msgId: string, toolCall: ToolCall) => void;
  updateToolCallResult: (sessionId: string, toolCallId: string, result: string) => void;
  finalizeMessage: (sessionId: string, msgId: string) => void;

  setStreaming: (val: boolean) => void;
  setError: (msg: string | null) => void;
}
```

---

## 七、后端接口需求

> 本节描述前端需要后端提供的接口，供后端开发参考。

### 7.1 接口列表

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 发送消息（SSE） | POST | `/api/chat/stream` | 发送消息，返回 SSE 流 |
| 获取历史消息 | GET | `/api/chat/history` | 获取会话历史 |
| 停止生成 | POST | `/api/chat/interrupt` | 中断当前生成 |
| 健康检查 | GET | `/api/health` | 服务状态检查 |

### 7.2 接口详情

#### POST /api/chat/stream

**Request：**
```json
{
  "content": "用户输入的消息",
  "sessionId": "demo-session",
  "userId": "user-001"
}
```

**Response：** `Content-Type: text/event-stream`

SSE 事件格式：
```
data: {"type":"AGENT_START"}

data: {"type":"MODEL_CALL_START"}

data: {"type":"THINKING_BLOCK_DELTA","delta":"让我思考一下..."}

data: {"type":"TEXT_BLOCK_DELTA","delta":"RAG 是"}

data: {"type":"TEXT_BLOCK_DELTA","delta":"一种技术..."}

data: {"type":"TOOL_CALL_START","toolCallName":"search_knowledge","toolCallId":"call_001","toolInput":"{\"query\":\"RAG\"}"}

data: {"type":"TOOL_RESULT_TEXT_DELTA","toolCallId":"call_001","delta":"搜索结果..."}

data: {"type":"AGENT_END"}

```

#### GET /api/chat/history

**Query Params：** `sessionId`, `userId`

**Response：**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "我想了解 RAG",
      "createdAt": 1719820800000
    },
    {
      "role": "assistant",
      "content": "RAG 是...",
      "createdAt": 1719820805000
    }
  ]
}
```

#### POST /api/chat/interrupt

**Request：**
```json
{
  "sessionId": "demo-session",
  "userId": "user-001"
}
```

### 7.3 CORS 配置（后端需开启）

```yaml
# application.yaml 追加
spring:
  webflux:
    cors:
      allowed-origins: "http://localhost:5173"
      allowed-methods: "*"
      allowed-headers: "*"
```

---

## 八、开发计划

### 阶段划分

| 阶段 | 内容 | 工时估算 |
|------|------|----------|
| **Phase 1** | 项目初始化 + 布局搭建 + 静态页面 | 1天 |
| **Phase 2** | 后端接口开发（Controller + SSE） | 1天 |
| **Phase 3** | 前端核心：SSE 接入 + 流式消息展示 | 1.5天 |
| **Phase 4** | 会话管理 + 历史消息 + 状态持久化 | 1天 |
| **Phase 5** | 工具调用可视化 + 思考过程展示 | 1天 |
| **Phase 6** | 样式完善 + 暗色模式 + 响应式 | 0.5天 |
| **Phase 7** | 联调测试 + Bug 修复 | 1天 |

**总计：约 7 个工作日**

### 里程碑

```
Week 1
  Day 1：✅ Phase 1 - 静态页面完成
  Day 2：✅ Phase 2 - 后端接口完成
  Day 3-4：✅ Phase 3 - 流式消息核心完成
  Day 5：✅ Phase 4 - 会话管理完成

Week 2
  Day 1：✅ Phase 5 - 工具可视化完成
  Day 2：✅ Phase 6 - 样式完善
  Day 3：✅ Phase 7 - 联调上线
```

---

## 九、开发规范

### 9.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `MessageBubble.tsx` |
| Hooks | camelCase + use 前缀 | `useChat.ts` |
| 工具函数 | camelCase | `parseSSEChunk` |
| 类型/接口 | PascalCase | `Message`, `AgentEvent` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SESSION_COUNT` |
| CSS 类 | Tailwind utility | `bg-blue-500 text-white` |

### 9.2 组件规范

```tsx
// 组件模板
import { FC } from 'react';
import { clsx } from 'clsx';

interface Props {
  // 所有 props 必须有类型
}

const MyComponent: FC<Props> = ({ ... }) => {
  return (
    <div className={clsx('base-class', condition && 'conditional-class')}>
      {/* 内容 */}
    </div>
  );
};

export default MyComponent;
```

### 9.3 代码质量

- TypeScript 严格模式（`"strict": true`）
- 禁止 `any` 类型（用 `unknown` 替代）
- 组件文件不超过 200 行，超过则拆分
- 自定义 Hook 负责所有副作用，组件只做渲染

---

## 十、风险与依赖

| 风险 | 影响 | 应对 |
|------|------|------|
| 后端 SSE 接口未实现 | 阻塞前端联调 | Phase 2 并行开发，前端先用 Mock 数据 |
| DeepSeek API 限流 | 影响演示效果 | 增加错误提示和重试逻辑 |
| 浏览器 SSE 兼容性 | 部分旧浏览器不支持 | 降级为轮询（低优先级） |
| 跨域问题 | 前后端无法通信 | 后端配置 CORS，Vite 配置代理 |

---

## 十一、验收标准

| 功能 | 验收标准 |
|------|----------|
| 消息发送 | 用户输入消息，后端收到请求，前端显示发送的消息 |
| 流式输出 | AI 回答逐字显示，无明显卡顿 |
| 工具调用展示 | 工具调用时显示工具名称和状态变化 |
| 会话切换 | 切换会话后显示对应历史消息 |
| 停止生成 | 点击停止后 AI 停止输出 |
| 暗色模式 | 切换主题后全页面样式正确更新 |
| 错误处理 | 后端报错时显示错误提示，可重试 |
| 响应式 | 768px 宽度下布局正常可用 |

---

## 附录：Vite 代理配置

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
});
```

## 附录：环境变量

```bash
# .env.development
VITE_API_BASE_URL=http://localhost:8080
VITE_DEFAULT_USER_ID=user-001
VITE_APP_TITLE=AI 智能问答
```
