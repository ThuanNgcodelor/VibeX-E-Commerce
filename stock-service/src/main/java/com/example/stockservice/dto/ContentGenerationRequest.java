package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContentGenerationRequest {
    // For Product Description
    private String productName;
    private String keywords;
    private Map<String, String> attributes;

    // For Review Reply
    private String reviewComment;
    private Integer rating;
    private String customerName;

    // Common
    private String language; // "vi" or "en"
    private String tone; // "professional", "friendly", "funny"

    // Multimodal
    private java.util.List<String> images; // Base64 encoded images
}
