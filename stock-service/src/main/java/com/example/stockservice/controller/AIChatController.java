package com.example.stockservice.controller;

import com.example.stockservice.dto.AIChatRequest;
import com.example.stockservice.dto.AIChatResponse;
import com.example.stockservice.service.ai.AIChatService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/stock/ai-chat")
@RequiredArgsConstructor
@Tag(name = "AI Chat", description = "AI Chatbot powered by Ollama + Qwen")
public class AIChatController {

    private final AIChatService aiChatService;

    @PostMapping("/message")
    @Operation(summary = "Gửi tin nhắn tới AI", description = "Gửi tin nhắn và nhận phản hồi từ AI chatbot")
    public ResponseEntity<AIChatResponse> chat(@RequestBody AIChatRequest request) {
        AIChatResponse response = aiChatService.chat(request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/conversation/{conversationId}")
    @Operation(summary = "Xóa lịch sử hội thoại", description = "Xóa lịch sử chat của một conversation")
    public ResponseEntity<Void> clearConversation(@PathVariable String conversationId) {
        aiChatService.clearConversation(conversationId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/health")
    @Operation(summary = "Kiểm tra trạng thái AI service")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("AI Chat Service is running");
    }
}
