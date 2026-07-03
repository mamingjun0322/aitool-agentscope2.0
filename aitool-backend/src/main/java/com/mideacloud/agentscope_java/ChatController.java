package com.mideacloud.agentscope_java;

// ==================== 第三方库导入 ====================
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariDataSource;
import io.agentscope.extensions.mysql.state.MysqlAgentStateStore;

// ==================== AgentScope Core 导入 ====================
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.AgentEventType;
import io.agentscope.core.event.ConfirmResult;
import io.agentscope.core.event.RequireUserConfirmEvent;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.event.ThinkingBlockDeltaEvent;
import io.agentscope.core.event.ToolCallStartEvent;
import io.agentscope.core.event.ToolResultTextDeltaEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.ToolUseBlock;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.OpenAIChatModel;
import io.agentscope.core.model.transport.HttpTransportConfig;
import io.agentscope.core.model.transport.HttpVersion;
import io.agentscope.core.model.transport.JdkHttpTransport;
import io.agentscope.core.permission.PermissionBehavior;
import io.agentscope.core.permission.PermissionContextState;
import io.agentscope.core.permission.PermissionMode;
import io.agentscope.core.permission.PermissionRule;
import io.agentscope.core.skill.repository.GitSkillRepository;
import io.agentscope.core.state.AgentState;
import io.agentscope.core.state.AgentStateStore;

// ==================== AgentScope Harness 导入 ====================
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.MemoryConfig;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import io.agentscope.harness.agent.memory.compaction.ToolResultEvictionConfig;
import io.agentscope.harness.agent.filesystem.spec.LocalFilesystemSpec;
import io.agentscope.harness.agent.workspace.LocalFsMode;

// ==================== AgentScope RAG 导入 ====================
import io.agentscope.core.rag.KnowledgeRetrievalTools;
import io.agentscope.core.rag.knowledge.SimpleKnowledge;
import io.agentscope.core.rag.store.InMemoryStore;
import io.agentscope.core.embedding.EmbeddingModel;
import io.agentscope.core.embedding.dashscope.DashScopeTextEmbedding;
import io.agentscope.core.tool.Toolkit;

// ==================== Spring Boot 导入 ====================
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// ==================== Reactor 响应式编程导入 ====================
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

// ==================== Java 标准库导入 ====================
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * 聊天控制器 - 基于 AgentScope Java 框架的智能对话 API
 *
 * <p>提供以下 REST 接口：
 * <ul>
 *   <li>POST /api/chat/stream - SSE 流式对话（实时推送 Agent 事件）</li>
 *   <li>GET /api/chat/history - 获取会话历史消息</li>
 *   <li>POST /api/chat/interrupt - 中断当前对话</li>
 *   <li>GET /api/health - 健康检查</li>
 * </ul>
 *
 * <p>核心组件：
 * <ul>
 *   <li>HarnessAgent - AgentScope 的核心 Agent，支持工具调用、上下文压缩、长期记忆</li>
 *   <li>MysqlAgentStateStore - 基于 MySQL 的会话状态持久化</li>
 * </ul>
 */
@RestController
@RequestMapping("/api")
public class ChatController {

    /** AgentScope 核心 Agent 实例，封装了推理、工具调用、记忆等能力 */
    private final HarnessAgent agent;

    /** 会话状态存储，用于持久化和恢复对话上下文（基于 MySQL） */
    private final AgentStateStore stateStore;

    /** JSON 序列化工具，用于将事件数据转换为 SSE 响应格式 */
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 等待用户确认的原始工具调用，按用户和会话隔离 */
    private final ConcurrentMap<String, List<ToolUseBlock>> pendingConfirmations =
            new ConcurrentHashMap<>();

    /** 当前使用的模型名称，用于健康检查接口返回 */
    @Value("${agent.model.name:deepseek-v4-flash}")
    private String modelName;

    /**
     * 构造函数 - 初始化 Agent 及其所有配置
     *
     * <p>通过 Spring 的 @Value 注解从 application.yml 注入配置参数，
     * 构建 HarnessAgent 实例，包括：模型、工作区、状态存储、文件系统、
     * 上下文压缩、工具结果卸载、长期记忆等模块。
     *
     * @param baseUrl       模型 API 基础 URL（默认：https://api.deepseek.com）
     * @param apiKey        模型 API 密钥
     * @param modelNameVal  模型名称（默认：deepseek-v4-flash）
     * @param sysPrompt     系统提示词，定义 Agent 的角色和行为
     * @param maxIters      单次对话最大推理-行动迭代次数（默认：10）
     * @param workspace     Agent 工作区目录路径（默认：.agentscope/workspace）
     * @param triggerTokens  触发上下文压缩的 token 阈值（默认：40000）
     * @param keepTokens     压缩后保留的最近 token 数（默认：8000）
     * @param triggerMessages 触发上下文压缩的消息数阈值（默认：80）
     * @param keepMessages   压缩后保留的最近消息数（默认：30）
     * @param flushBeforeCompact   压缩前是否先刷新长期记忆（默认：true）
     * @param offloadBeforeCompact 压缩前是否先卸载原始日志到文件（默认：true）
     * @param truncateArgsMaxLength 工具调用参数截断最大长度（默认：2000）
     * @param evictionMaxSize 工具结果卸载的字符阈值，超过此值的结果写入文件（默认：50000）
     * @param asyncFlush    是否异步刷新长期记忆（默认：true）
     */
    public ChatController(
            @Value("${agent.model.base-url:https://api.deepseek.com}") String baseUrl,
            @Value("${agent.model.api-key}") String apiKey,
            @Value("${agent.model.name:deepseek-v4-flash}") String modelNameVal,
            @Value("${agent.sys-prompt:你是一个智能问答助手，帮助用户解答各类问题。请用中文回答。}") String sysPrompt,
            @Value("${agent.max-iters:10}") int maxIters,
            @Value("${agent.workspace:.agentscope/workspace}") String workspace,
            @Value("${agent.compaction.trigger-tokens:40000}") int triggerTokens,
            @Value("${agent.compaction.keep-tokens:8000}") int keepTokens,
            @Value("${agent.compaction.trigger-messages:80}") int triggerMessages,
            @Value("${agent.compaction.keep-messages:30}") int keepMessages,
            @Value("${agent.compaction.flush-before-compact:true}") boolean flushBeforeCompact,
            @Value("${agent.compaction.offload-before-compact:true}") boolean offloadBeforeCompact,
            @Value("${agent.compaction.truncate-args-max-length:2000}") int truncateArgsMaxLength,
            @Value("${agent.tool-result-eviction.max-size:50000}") int evictionMaxSize,
            @Value("${agent.memory.async-flush:true}") boolean asyncFlush,
            @Value("${agent.rag.api-key}") String ragApiKey,
            @Value("${agent.rag.model-name:text-embedding-v3}") String ragModelName,
            @Value("${agent.rag.dimensions:1024}") int ragDimensions,
            @Value("${agent.skill.git-url:}") String skillGitUrl,
            @Value("${agent.skill.branch:main}") String skillBranch,
            @Value("${agent.mysql.jdbc-url}") String mysqlJdbcUrl,
            @Value("${agent.mysql.username}") String mysqlUsername,
            @Value("${agent.mysql.password}") String mysqlPassword,
            @Value("${agent.mysql.database-name:agentscope}") String mysqlDatabaseName,
            @Value("${agent.mysql.table-name:agentscope_sessions}") String mysqlTableName,
            @Value("${agent.mysql.create-if-not-exist:true}") boolean mysqlCreateIfNotExist) {

        // ==================== 0. 构建 HTTP 传输层 ====================
        // 强制使用 HTTP/1.1，避免 vLLM 等不支持 HTTP/2 的服务端返回 400
        JdkHttpTransport httpTransport = JdkHttpTransport.builder()
                .config(HttpTransportConfig.builder()
                        .httpVersion(HttpVersion.HTTP_1_1)
                        .build())
                .build();

        // ==================== 1. 构建主推理模型 ====================
        OpenAIChatModel mainModel = OpenAIChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelNameVal)
                .httpTransport(httpTransport)
                .build();

        // ==================== 2. 构建摘要/压缩专用模型 ====================
        OpenAIChatModel compactionModel = OpenAIChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelNameVal)
                .httpTransport(httpTransport)
                .build();

        // ==================== 3. 初始化 MySQL 会话状态存储 ====================
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(mysqlJdbcUrl);
        ds.setUsername(mysqlUsername);
        ds.setPassword(mysqlPassword);
        this.stateStore = new MysqlAgentStateStore(
                ds, mysqlDatabaseName, mysqlTableName, mysqlCreateIfNotExist);

        // ==================== 4. 构建 RAG 知识库 ====================
        // Embedding 模型（使用阿里云百炼 DashScope 的 text-embedding-v3）
        EmbeddingModel embeddings = DashScopeTextEmbedding.builder()
                .apiKey(ragApiKey)
                .modelName(ragModelName)
                .dimensions(ragDimensions)
                .build();

        // 向量库（开发用内存版，生产可换 PgVectorStore / MilvusStore 等）
        InMemoryStore store = InMemoryStore.builder().dimensions(1024).build();

        // 组装 Knowledge
        SimpleKnowledge knowledge = SimpleKnowledge.builder()
                .embeddingModel(embeddings)
                .embeddingStore(store)
                .build();

        // 包装成工具，注册到 Toolkit
        KnowledgeRetrievalTools ragTools = new KnowledgeRetrievalTools(knowledge);
        Toolkit toolkit = new Toolkit();
        toolkit.registerTool(ragTools);
        toolkit.registerTool(new CrossPlatformExecuteTool(Paths.get(System.getProperty("user.dir"))));

        // ==================== 5. 构建 Git 技能仓库（可选） ====================
        GitSkillRepository skillRepo = null;
        if (skillGitUrl != null && !skillGitUrl.isBlank()) {
            skillRepo = new GitSkillRepository(skillGitUrl, skillBranch);
        }
        final GitSkillRepository finalSkillRepo = skillRepo;

        // ==================== 6. 构建权限上下文 ====================
        PermissionContextState permCtx = buildPermissionContext();

        // ==================== 7. 构建 HarnessAgent 核心实例 ====================
        HarnessAgent.Builder agentBuilder = HarnessAgent.builder()
                // --- 基础配置 ---
                .name("assistant")                          // Agent 名称标识
                .sysPrompt(sysPrompt)                       // 系统提示词，定义 Agent 角色
                .model(mainModel)                           // 主推理模型
                .workspace(Paths.get(workspace))            // 工作区目录（文件读写根目录）
                .stateStore(stateStore)                     // 会话状态持久化存储
                .filesystem(                                // 文件系统配置：UNRESTRICTED 模式允许访问任意路径
                        new LocalFilesystemSpec()
                                .mode(LocalFsMode.UNRESTRICTED))
                .toolkit(toolkit)                           // RAG 知识库检索工具
                .maxIters(maxIters)                         // 单次对话最大推理-行动循环次数
                .permissionContext(permCtx)                  // 权限控制
                .disableShellTool();                         // RC3 默认调用 sh，Windows 下不可用

        // 注册 Git 技能仓库（如果配置了的话）
        if (finalSkillRepo != null) {
            agentBuilder.skillRepository(finalSkillRepo);
        }

        this.agent = agentBuilder
                // --- 上下文压缩配置（激进型） ---
                // 当对话过长时自动压缩历史消息，防止超出模型 token 上限
                .compaction(CompactionConfig.builder()
                        .triggerTokens(triggerTokens)       // token 数达到此阈值时触发压缩
                        .keepTokens(keepTokens)             // 压缩后保留最近 N 个 token
                        .triggerMessages(triggerMessages)   // 消息数达到此阈值时触发压缩
                        .keepMessages(keepMessages)         // 压缩后保留最近 N 条原始消息
                        .flushBeforeCompact(flushBeforeCompact)     // 压缩前先将重要信息写入长期记忆
                        .offloadBeforeCompact(offloadBeforeCompact) // 压缩前将原始日志卸载到文件
                        .model(compactionModel)             // 使用便宜模型执行摘要压缩
                        .truncateArgs(                      // 工具调用参数截断配置
                                CompactionConfig.TruncateArgsConfig.builder()
                                        .maxArgLength(truncateArgsMaxLength)
                                        .truncationText("... [参数过长已截断] ...")
                                        .build())
                        .build())

                // --- 大工具结果卸载配置 ---
                // 当工具返回结果过大时，将完整结果写入文件，上下文中只保留摘要+文件引用
                .toolResultEviction(ToolResultEvictionConfig.builder()
                        .maxResultChars(evictionMaxSize)    // 超过此字符数的结果将被卸载到文件
                        .build())

                // --- 长期记忆配置 ---
                // 支持跨会话的持久化记忆，Agent 可以在对话中记住重要信息
                .memory(MemoryConfig.builder()
                        .flushTrigger(                      // 记忆刷新触发策略
                                asyncFlush
                                        ? MemoryConfig.FlushTrigger.always()   // 每次对话后都刷新
                                        : MemoryConfig.FlushTrigger.never())   // 不自动刷新
                        .build())
                .build();

        this.modelName = modelNameVal;
    }

    // =======================================================================
    //  POST /api/chat/stream — SSE 流式对话接口
    // =======================================================================

    /**
     * 聊天请求体
     *
     * @param content   用户输入的消息内容
     * @param sessionId 会话 ID，用于关联同一对话的多轮消息（可选，默认 "default-session"）
     * @param userId    用户 ID，用于隔离不同用户的会话状态（可选，默认 "user-001"）
     */
    public record ChatRequest(String content, String sessionId, String userId) {}

    /**
     * 流式对话接口 - 通过 SSE（Server-Sent Events）实时推送 Agent 事件
     *
     * <p>事件类型包括：
     * <ul>
     *   <li>TEXT_BLOCK_DELTA - Agent 生成的文本片段</li>
     *   <li>THINKING_BLOCK_DELTA - Agent 的思考过程</li>
     *   <li>TOOL_CALL_START / TOOL_CALL_END - 工具调用的开始和结束</li>
     *   <li>TOOL_RESULT_TEXT_DELTA - 工具返回结果的文本流</li>
     *   <li>REQUIRE_USER_CONFIRM - 权限系统要求用户确认（HITL），收到后需调用 /api/chat/confirm</li>
     *   <li>ERROR - 错误信息</li>
     * </ul>
     *
     * <p>注意：当收到 REQUIRE_USER_CONFIRM 事件时，SSE 流会主动完成，
     * 前端需显示确认界面，用户决策后调用 /api/chat/confirm 接口恢复执行。
     *
     * @param req 聊天请求体
     * @return SSE 事件流
     */
    @PostMapping(value = "/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> streamChat(@RequestBody ChatRequest req) {
        String sessionId = req.sessionId() != null ? req.sessionId() : "default-session";
        String userId = req.userId() != null ? req.userId() : "user-001";

        RuntimeContext ctx = RuntimeContext.builder()
                .sessionId(sessionId)
                .userId(userId)
                .build();

        UserMessage userMsg = new UserMessage(req.content());

        return agent.streamEvents(userMsg, ctx)
                .subscribeOn(Schedulers.boundedElastic())
                .map(event -> toSSE(event, confirmationKey(userId, sessionId)))
                .takeUntil(sse -> {
                    try {
                        String data = sse.data();
                        if (data != null && data.contains("REQUIRE_USER_CONFIRM")) {
                            return true;
                        }
                    } catch (Exception ignored) {
                    }
                    return false;
                })
                .onErrorResume(e -> {
                    Map<String, Object> err = new HashMap<>();
                    err.put("type", "ERROR");
                    err.put("error", e.getMessage() != null ? e.getMessage() : "未知错误");
                    return Flux.just(toSseRaw(err));
                });
    }

    // =======================================================================
    //  GET /api/chat/history — 获取会话历史消息
    // =======================================================================

    /**
     * 获取指定会话的历史消息列表
     *
      * <p>从 MysqlAgentStateStore 中读取持久化的 Agent 状态，
     * 提取对话上下文中的用户和助手消息（过滤掉 system 消息）。
     *
     * @param sessionId 会话 ID
     * @param userId    用户 ID
     * @return 包含消息列表的 Map，每条消息包含 role、content、timestamp、id
     */
    @GetMapping("/chat/history")
    public Mono<Map<String, Object>> getHistory(
            @RequestParam String sessionId,
            @RequestParam String userId) {

        return Mono.fromCallable(() -> {
            List<Map<String, Object>> messages = new ArrayList<>();
            try {
                // 从状态存储中读取指定用户和会话的 Agent 状态
                Optional<AgentState> stateOpt = stateStore.get(
                        userId, sessionId, "agent_state", AgentState.class);
                if (stateOpt.isPresent()) {
                    // 获取对话上下文消息列表
                    List<Msg> context = stateOpt.get().getContext();
                    for (Msg msg : context) {
                        if (msg.getRole() == null) continue;
                        String role = msg.getRole().name().toLowerCase();
                        // 过滤掉 system 角色的消息（系统提示词），只返回用户和助手消息
                        if ("system".equals(role)) continue;

                        Map<String, Object> msgMap = new HashMap<>();
                        msgMap.put("role", role);
                        msgMap.put("content", msg.getTextContent());
                        msgMap.put("timestamp", msg.getTimestamp());
                        msgMap.put("id", msg.getId());
                        messages.add(msgMap);
                    }
                }
            } catch (Exception e) {
                // 读取失败时返回空列表，不阻断前端
            }
            Map<String, Object> result = new HashMap<>();
            result.put("messages", messages);
            return result;
        }).subscribeOn(Schedulers.boundedElastic());
    }

    // =======================================================================
    //  POST /api/chat/interrupt — 中断当前对话
    // =======================================================================

    /**
     * 中断请求体
     *
     * @param sessionId 会话 ID
     * @param userId    用户 ID
     */
    public record InterruptRequest(String sessionId, String userId) {}

    /**
     * 中断当前正在进行的 Agent 推理
     *
     * <p>调用 agent.interrupt() 发送中断信号，Agent 会在下一个检查点停止推理。
     * 中断操作是尽力而为（best-effort）的，不保证立即停止。
     *
     * @param req 中断请求体
     * @return 操作结果状态
     */
    @PostMapping("/chat/interrupt")
    public Mono<Map<String, Object>> interrupt(@RequestBody InterruptRequest req) {
        try {
            agent.interrupt();
        } catch (Exception ignored) {
            // interrupt is best-effort
        }
        Map<String, Object> result = new HashMap<>();
        result.put("status", "ok");
        return Mono.just(result);
    }

    // =======================================================================
    //  GET /api/health — 健康检查接口
    // =======================================================================

    /**
     * 健康检查接口 - 返回服务运行状态和基本信息
     *
     * @return 包含服务状态、Agent 名称、模型名称的 Map
     */
    @GetMapping("/health")
    public Mono<Map<String, Object>> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "UP");
        result.put("service", "agentscope-java");
        result.put("agent", agent.getName());
        result.put("model", modelName);
        return Mono.just(result);
    }

    // =======================================================================
    //  POST /api/chat/confirm — 用户确认权限请求
    // =======================================================================

    /**
     * 权限确认请求体
     *
     * @param sessionId 会话 ID
     * @param userId    用户 ID
     * @param approved  用户是否批准
     * @param message   用户回复（如 "yes, proceed" 或 "no, cancel"）
     */
    public record ConfirmToolCallRequest(String id, String name, Map<String, Object> input) {}

    public record ConfirmRequest(
            String sessionId,
            String userId,
            boolean approved,
            String message,
            List<ConfirmToolCallRequest> toolCalls) {}

    /**
     * 用户确认接口 - 处理权限系统的人工确认（HITL）
     *
     * <p>当 Agent 遇到 ASK 规则时暂停，前端通过此接口发送用户决策后恢复执行。
     * 如果恢复执行后再次遇到 ASK 规则，会再次发送 REQUIRE_USER_CONFIRM 事件并完成流。
     *
     * @param req 确认请求体
     * @return SSE 事件流（恢复后的 Agent 事件）
     */
    @PostMapping(value = "/chat/confirm", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> confirm(@RequestBody ConfirmRequest req) {
        String sessionId = req.sessionId() != null ? req.sessionId() : "default-session";
        String userId = req.userId() != null ? req.userId() : "user-001";

        RuntimeContext ctx = RuntimeContext.builder()
                .sessionId(sessionId)
                .userId(userId)
                .build();

        String confirmationKey = confirmationKey(userId, sessionId);
        List<ToolUseBlock> toolCalls = pendingConfirmations.remove(confirmationKey);
        if ((toolCalls == null || toolCalls.isEmpty())
                && req.toolCalls() != null
                && !req.toolCalls().isEmpty()) {
            toolCalls = req.toolCalls().stream()
                    .map(toolCall -> new ToolUseBlock(
                            toolCall.id(), toolCall.name(), toolCall.input()))
                    .toList();
        }
        if (toolCalls == null || toolCalls.isEmpty()) {
            return Flux.just(toSseRaw(Map.of(
                    "type", "ERROR",
                    "error", "当前会话没有等待确认的工具调用，请重新发起请求")));
        }

        List<ConfirmResult> confirmResults = toolCalls.stream()
                .map(toolCall -> new ConfirmResult(req.approved(), toolCall))
                .toList();
        UserMessage resumeMsg = UserMessage.builder()
                .metadata(Map.of(Msg.METADATA_CONFIRM_RESULTS, confirmResults))
                .build();

        return agent.streamEvents(resumeMsg, ctx)
                .subscribeOn(Schedulers.boundedElastic())
                .map(event -> toSSE(event, confirmationKey))
                .takeUntil(sse -> {
                    try {
                        String data = sse.data();
                        if (data != null && data.contains("REQUIRE_USER_CONFIRM")) {
                            return true;
                        }
                    } catch (Exception ignored) {
                    }
                    return false;
                })
                .onErrorResume(e -> {
                    Map<String, Object> err = new HashMap<>();
                    err.put("type", "ERROR");
                    err.put("error", e.getMessage() != null ? e.getMessage() : "未知错误");
                    return Flux.just(toSseRaw(err));
                });
    }

    // =======================================================================
    //  辅助方法
    // =======================================================================

    /**
     * 构建权限上下文 - DEFAULT 模式 + 人工确认
     *
     * <p>只读工具自动放行（ALLOW），写入/执行工具需用户确认（ASK）。
     * 未命中任何规则的操作默认需要用户确认。
     */
    private PermissionContextState buildPermissionContext() {
        PermissionContextState.Builder builder = PermissionContextState.builder()
                .mode(PermissionMode.DEFAULT);

        // ALLOW - 只读/安全工具，自动放行
        String[] allowTools = {
                "read_file", "grep_files", "glob_files", "list_files",
                "memory_search", "memory_get",
                "retrieve_knowledge",
                "session_search", "session_list", "session_history",
                "load_skill_through_path",
                "todo_write",
                "plan_enter", "plan_exit",
                "agent_list",
                "task_output", "task_list"
        };
        for (String tool : allowTools) {
            builder.addAllowRule(tool,
                    new PermissionRule(tool, null, PermissionBehavior.ALLOW, "userSettings"));
        }

        // ASK - 写入/执行工具，需要用户确认
        String[] askTools = {
                "write_file", "edit_file", "execute",
                "memory_save",
                "plan_write",
                "agent_spawn", "agent_send", "agent_generate",
                "skill_manage", "propose_skill",
                "task_cancel", "wait_async_results"
        };
        for (String tool : askTools) {
            builder.addAskRule(tool,
                    new PermissionRule(tool, null, PermissionBehavior.ASK, "userSettings"));
        }

        return builder.build();
    }

    /**
     * 将 AgentEvent 转换为 SSE（Server-Sent Event）格式
     *
     * <p>根据不同的事件类型提取对应的数据字段，封装为 JSON 格式的 SSE 事件。
     * 前端通过监听不同的 type 字段来渲染对应的 UI 效果。
     *
     * @param event Agent 产生的事件
     * @return SSE 事件，data 字段为 JSON 字符串
     */
    private ServerSentEvent<String> toSSE(AgentEvent event, String confirmationKey) {
        Map<String, Object> map = new HashMap<>();
        AgentEventType type = event.getType();
        map.put("type", type.name());

        switch (type) {
            // Agent 生成的文本增量片段
            case TEXT_BLOCK_DELTA ->
                    map.put("delta", ((TextBlockDeltaEvent) event).getDelta());

            // Agent 的思考过程增量片段（Chain of Thought）
            case THINKING_BLOCK_DELTA ->
                    map.put("delta", ((ThinkingBlockDeltaEvent) event).getDelta());

            // 工具调用开始：包含工具名称和调用 ID
            case TOOL_CALL_START -> {
                ToolCallStartEvent e = (ToolCallStartEvent) event;
                map.put("toolCallName", e.getToolCallName());
                map.put("toolCallId", e.getToolCallId());
            }

            // 工具调用结束：前端只需 type 字段即可
            case TOOL_CALL_END -> {
            }

            // 工具返回结果的文本增量流
            case TOOL_RESULT_TEXT_DELTA -> {
                ToolResultTextDeltaEvent e = (ToolResultTextDeltaEvent) event;
                map.put("toolCallId", e.getToolCallId());
                map.put("delta", e.getDelta());
            }

            // 权限系统要求用户确认（HITL）
            case REQUIRE_USER_CONFIRM -> {
                RequireUserConfirmEvent e = (RequireUserConfirmEvent) event;
                pendingConfirmations.put(confirmationKey, List.copyOf(e.getToolCalls()));
                map.put("replyId", e.getReplyId());
                List<Map<String, Object>> toolCalls = new ArrayList<>();
                for (ToolUseBlock tb : e.getToolCalls()) {
                    Map<String, Object> tc = new HashMap<>();
                    tc.put("id", tb.getId());
                    tc.put("name", tb.getName());
                    tc.put("input", tb.getInput());
                    toolCalls.add(tc);
                }
                map.put("toolCalls", toolCalls);
            }

            // 其他事件类型（AGENT_START/END、MODEL_CALL_START/END 等）仅携带 type
            default -> {
            }
        }

        return toSseRaw(map);
    }

    private String confirmationKey(String userId, String sessionId) {
        return userId + "\u0000" + sessionId;
    }

    /**
     * 将 Map 数据序列化为 JSON 字符串并封装为 SSE 事件
     *
     * @param map 要序列化的数据
     * @return SSE 事件；序列化失败时返回错误事件
     */
    private ServerSentEvent<String> toSseRaw(Map<String, Object> map) {
        try {
            return ServerSentEvent.<String>builder()
                    .data(objectMapper.writeValueAsString(map))
                    .build();
        } catch (Exception ex) {
            return ServerSentEvent.<String>builder()
                    .data("{\"type\":\"ERROR\",\"error\":\"serialization failed\"}")
                    .build();
        }
    }
}
