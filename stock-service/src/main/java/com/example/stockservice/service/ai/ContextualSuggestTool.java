package com.example.stockservice.service.ai;

import com.example.stockservice.dto.ProductSuggestionDto;
import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Product;
import com.example.stockservice.service.product.ProductService;
import com.fasterxml.jackson.annotation.JsonClassDescription;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

@Configuration
@Slf4j
@RequiredArgsConstructor
public class ContextualSuggestTool {
    private final ProductService productService;
    
    // ThreadLocal to store products from last function call
    private static final ThreadLocal<List<ProductSuggestionDto>> LAST_PRODUCTS = new ThreadLocal<>();
    
    /**
     * Get products from last function call (called by AIChatService)
     */
    public static List<ProductSuggestionDto> getLastProducts() {
        List<ProductSuggestionDto> products = LAST_PRODUCTS.get();
        LAST_PRODUCTS.remove(); // Clean up
        return products;
    }
    
    /**
     * Tool để AI tự động suggest products theo scenario
     */
    @Bean
    @Description("Suggest products based on user scenario or activity (e.g., going to beach, party, gym). Use this when user mentions a specific activity or scenario.")
    public Function<SuggestionRequest, SuggestionResponse> suggestProductsByScenario() {
        return (request) -> {
            try {
                log.info("🔍 AI requesting product suggestions for scenario: {}", request.scenario());

                // Parse keywords
                List<String> keywords = List.of(request.scenario().split(","));
                log.info("📝 Parsed keywords: {}", keywords);
                
                // Search products for EACH keyword separately and combine results
                List<Product> allProducts = new java.util.ArrayList<>();
                for (String keyword : keywords) {
                    String trimmedKeyword = keyword.trim();
                    if (!trimmedKeyword.isEmpty()) {
                        try {
                            log.info("Searching for keyword: '{}'", trimmedKeyword);
                            Page<Product> page = productService.searchProductByKeyword(trimmedKeyword, 0, 10);
                            log.info("Found {} products for keyword '{}'", page.getContent().size(), trimmedKeyword);
                            allProducts.addAll(page.getContent());
                        } catch (Exception e) {
                            log.warn(" Failed to search for keyword: {}", trimmedKeyword, e);
                        }
                    }
                }
                
                log.info("📊 Total products found (before dedup): {}", allProducts.size());
                
                // Remove duplicates and limit to 6
                List<ProductSuggestionDto> products = allProducts.stream()
                        .distinct()  // Remove duplicates
                        .limit(6)    // Limit to 6 products
                        .map(p -> {
                            log.info("=== Product Mapping ===");
                            log.info("Product Name: {}", p.getName());
                            log.info("Product ID: {}", p.getId());
                            log.info("Category ID: {}", p.getCategory() != null ? p.getCategory().getId() : "null");
                            log.info("Image ID: {}", p.getImageId());
                            log.info("Price: {}", p.getPrice());
                            log.info("======================");
                            
                            return ProductSuggestionDto.builder()
                                    .id(p.getId())  // ← Product ID here
                                    .name(p.getName())
                                    .description(p.getDescription())
                                    .price(p.getPrice())
                                    .originalPrice(p.getOriginalPrice())
                                    .discountPercent(p.getDiscountPercent())
                                    .status(ProductStatus.IN_STOCK.name())
                                    .imageUrl(p.getImageId() != null && !p.getImageId().isEmpty()
                                            ? p.getImageId()  // ← Image ID here (not product ID!)
                                            : null)
                                    .build();
                        })
                        .collect(Collectors.toList());

                log.info("🎯 Final result: {} products", products.size());

                // Store products in ThreadLocal for AIChatService to retrieve
                LAST_PRODUCTS.set(products);

                // Build simple response message (AI will format this nicely)
                String responseMessage;
                if (products.isEmpty()) {
                    responseMessage = "Không tìm thấy sản phẩm phù hợp.";
                } else {
                    StringBuilder msg = new StringBuilder();
                    msg.append(String.format("Tìm thấy %d sản phẩm:\n", products.size()));
                    for (ProductSuggestionDto p : products) {
                        msg.append(String.format("- %s (%.0f VND)\n", p.getName(), p.getPrice()));
                    }
                    responseMessage = msg.toString();
                }

                return new SuggestionResponse(
                        products,
                        responseMessage
                );

            } catch (Exception e) {
                log.error(" Error suggesting products", e);
                LAST_PRODUCTS.remove(); // Clean up on error
                return new SuggestionResponse(List.of(), "Không thể tìm sản phẩm.");
            }
        };
    }

    @JsonClassDescription("Request for product suggestions based on user scenario")
    public record SuggestionRequest(
            @JsonProperty(required = true, value = "scenario")
            @JsonPropertyDescription("Comma-separated keywords describing the scenario (e.g., 'đồ bơi,kính râm,biển' for beach)")
            String scenario
    ) {}

    public record SuggestionResponse(
            List<ProductSuggestionDto> products,
            String message
    ) {}
}
