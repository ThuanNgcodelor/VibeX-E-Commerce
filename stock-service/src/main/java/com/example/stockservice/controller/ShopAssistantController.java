package com.example.stockservice.controller;

import com.example.stockservice.dto.ContentGenerationRequest;
import com.example.stockservice.service.ai.ContentGenerationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/v1/stock/shop-assistant")
@RequiredArgsConstructor
@Tag(name = "Shop Assistant AI", description = "AI Tools for Shop Owners")
public class ShopAssistantController {

    private final ContentGenerationService contentGenerationService;

    @PostMapping("/generate-description")
    @Operation(summary = "Generate Product Description", description = "Generate HTML product description based on name and attributes")
    public ResponseEntity<Map<String, String>> generateDescription(@RequestBody ContentGenerationRequest request) {
        String result = contentGenerationService.generateProductDescription(request);
        return ResponseEntity.ok(Map.of("result", result));
    }

    @PostMapping("/generate-reply")
    @Operation(summary = "Generate Review Reply", description = "Suggest a reply for a customer review")
    public ResponseEntity<Map<String, String>> generateReply(@RequestBody ContentGenerationRequest request) {
        String result = contentGenerationService.generateReviewReply(request);
        return ResponseEntity.ok(Map.of("result", result));
    }

    @PostMapping("/generate-decoration")
    @Operation(summary = "Generate Shop Decoration", description = "Generate a complete shop decoration config from a text prompt")
    public ResponseEntity<Map<String, String>> generateDecoration(@RequestBody ContentGenerationRequest request) {
        String result = contentGenerationService.generateShopDecoration(request);
        return ResponseEntity.ok(Map.of("result", result));
    }
}
