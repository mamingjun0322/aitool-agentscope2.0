package com.mideacloud.agentscope_java;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.agentscope.core.agent.RuntimeContext;
import io.agentscope.core.event.AgentEvent;
import io.agentscope.core.event.AgentEventType;
import io.agentscope.core.event.TextBlockDeltaEvent;
import io.agentscope.core.event.ThinkingBlockDeltaEvent;
import io.agentscope.core.event.ToolCallStartEvent;
import io.agentscope.core.event.ToolResultTextDeltaEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.UserMessage;
import io.agentscope.core.model.OpenAIChatModel;
import io.agentscope.core.state.AgentState;
import io.agentscope.core.state.JsonFileAgentStateStore;
import io.agentscope.harness.agent.HarnessAgent;
import io.agentscope.harness.agent.memory.MemoryConfig;
import io.agentscope.harness.agent.memory.compaction.CompactionConfig;
import io.agentscope.harness.agent.memory.eviction.ToolResultEvictionConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ChatController {

//1111
    private final HarnessAgent agent;
    private final JsonFileAgentStateStore stateStore;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${agent.model.name:deepseek-v4-flash}")
    private String modelName;

    public ChatController(
            @Value("${agent.model.base-url:https://api.deepseek.com}") String baseUrl,
            @Value("${agent.model.api-key}") String apiKey,
            @Value("${agent.model.name:deepseek-v4-flash}") String modelNameVal,
            @Value("${agent.sys-prompt:你是一个智能问答助手，帮助用户解答各类问题。请用中文回答。}") String sysPrompt,
            @Value("${agent.max-iters:10}") int maxIters,
            @Value("${agent.workspace:.agentscope/workspace}") String workspace,
            @Value("${agent.state-store:.agentscope/sessions}") String stateStorePath,
            // 压缩配置
            @Value("${agent.compaction.trigger-tokens:40000}") int triggerTokens,
            @Value("${agent.compaction.keep-tokens:8000}") int keepTokens,
            @Value("${agent.compaction.trigger-messages:80}") int triggerMessages,
            @Value("${agent.compaction.keep-messages:30}") int keepMessages,
            @Value("${agent.compaction.flush-before-compact:true}") boolean flushBeforeCompact,
            @Value("${agent.compaction.offload-before-compact:true}") boolean offloadBeforeCompact,
            @Value("${agent.compaction.truncate-args-max-length:2000}") int truncateArgsMaxLength,
            // 工具结果卸载
            @Value("${agent.tool-result-eviction.max-size:50000}") int evictionMaxSize,
            // 记忆
            @Value("${agent.memory.async-flush:true}") boolean asyncFlush) {

        // 主模型（推理）
        OpenAIChatModel mainModel = OpenAIChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(modelNameVal)
                .build();

        // 摘要模型（用更便宜的 deepseek-chat）
        OpenAIChatModel compactionModel = OpenAIChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName("deepseek-chat")  // 比 v4-flash 便宜
                .build();

        this.stateStore = new JsonFileAgentStateStore(Paths.get(stateStorePath));

        this.agent = HarnessAgent.builder()
                .name("assistant")
                .sysPrompt(sysPrompt)
                .model(mainModel)
                .workspace(Paths.get(workspace))
                .stateStore(stateStore)
                .maxIters(maxIters)
                // 激进型压缩配置
                .compaction(CompactionConfig.builder()
                        .triggerTokens(triggerTokens)
                        .keepTokens(keepTokens)
                        .triggerMessages(triggerMessages)
                        .keepMessages(keepMessages)
                        .flushBeforeCompact(flushBeforeCompact)
                        .offloadBeforeCompact(offloadBeforeCompact)
                        .model(compactionModel)  // 使用便宜模型做摘要
                        .truncateArgs(CompactionConfig.TruncateArgsConfig.builder()
                                .maxArgLength(truncateArgsMaxLength)
                                .truncationText("... [参数过长已截断] ...")
                                .build())
                        .build())
                // 大工具结果卸载
                .toolResultEviction(ToolResultEvictionConfig.builder()
                        .maxSize(evictionMaxSize)
                        .build())
                // 长期记忆
                .memory(MemoryConfig.builder()
                        .memoryDir(Paths.get(workspace, "memory"))
                        .asyncFlush(asyncFlush)
                        .build())
                .build();

        this.modelName = modelNameVal;
    }

    // -----------------------------------------------------------------------
    // POST /api/chat/stream  — SSE streaming chat
    // -----------------------------------------------------------------------

    public record ChatRequest(String content, String sessionId, String userId) {}

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
                .map(this::toSSE)
                .onErrorResume(e -> {
                    Map<String, Object> err = new HashMap<>();
                    err.put("type", "ERROR");
                    err.put("error", e.getMessage() != null ? e.getMessage() : "未知错误");
                    return Flux.just(toSseRaw(err));
                });
    }

    // -----------------------------------------------------------------------
    // GET /api/chat/history
    // -----------------------------------------------------------------------

    @GetMapping("/chat/history")
    public Mono<Map<String, Object>> getHistory(
            @RequestParam String sessionId,
            @RequestParam String userId) {

        return Mono.fromCallable(() -> {
            List<Map<String, Object>> messages = new ArrayList<>();
            try {
                Optional<AgentState> stateOpt = stateStore.get(userId, sessionId, "agent_state", AgentState.class);
                if (stateOpt.isPresent()) {
                    List<Msg> context = stateOpt.get().getContext();
                    for (Msg msg : context) {
                        if (msg.getRole() == null) continue;
                        String role = msg.getRole().name().toLowerCase();
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

    // -----------------------------------------------------------------------
    // POST /api/chat/interrupt
    // -----------------------------------------------------------------------

    public record InterruptRequest(String sessionId, String userId) {}

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

    // -----------------------------------------------------------------------
    // GET /api/health
    // -----------------------------------------------------------------------

    @GetMapping("/health")
    public Mono<Map<String, Object>> health() {
        Map<String, Object> result = new HashMap<>();
        result.put("status", "UP");
        result.put("service", "agentscope-java");
        result.put("agent", agent.getName());
        result.put("model", modelName);
        return Mono.just(result);
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private ServerSentEvent<String> toSSE(AgentEvent event) {
        Map<String, Object> map = new HashMap<>();
        AgentEventType type = event.getType();
        map.put("type", type.name());

        switch (type) {
            case TEXT_BLOCK_DELTA ->
                    map.put("delta", ((TextBlockDeltaEvent) event).getDelta());

            case THINKING_BLOCK_DELTA ->
                    map.put("delta", ((ThinkingBlockDeltaEvent) event).getDelta());

            case TOOL_CALL_START -> {
                ToolCallStartEvent e = (ToolCallStartEvent) event;
                map.put("toolCallName", e.getToolCallName());
                map.put("toolCallId", e.getToolCallId());
            }

            case TOOL_CALL_END -> {
                // 前端 useChat.ts 监听 TOOL_CALL_END 但只需 type 字段，无需额外字段
            }

            case TOOL_RESULT_TEXT_DELTA -> {
                ToolResultTextDeltaEvent e = (ToolResultTextDeltaEvent) event;
                map.put("toolCallId", e.getToolCallId());
                map.put("delta", e.getDelta());
            }

            default -> {
                // AGENT_START / AGENT_END / MODEL_CALL_START / MODEL_CALL_END 等，仅携带 type
            }
        }

        return toSseRaw(map);
    }

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
