package com.example.stockservice.service.ai;

import com.example.stockservice.dto.ProductSuggestionDto;
import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Category;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.CategoryRepository;
import com.example.stockservice.service.product.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Description;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Advanced Product Tools for AI Function Calling
 * Cung cấp thông tin sản phẩm chi tiết: trending, mới, theo category
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdvancedProductTools {

    private final ProductService productService;
    private final CategoryRepository categoryRepository;

    // ThreadLocal to store products for carousel display
    private static final ThreadLocal<List<ProductSuggestionDto>> LAST_PRODUCTS = new ThreadLocal<>();

    /**
     * Get products from last function call (called by AIChatService)
     */
    public static List<ProductSuggestionDto> getLastProducts() {
        List<ProductSuggestionDto> products = LAST_PRODUCTS.get();
        LAST_PRODUCTS.remove(); // Clean up
        return products;
    }

    // ============ Request/Response Records ============

    public record GetTrendingProductsRequest(Integer limit) {
    }

    public record GetTrendingProductsResponse(List<ProductInfo> products, String message) {
    }

    public record GetNewArrivalsRequest(Integer days, Integer limit) {
    }

    public record GetNewArrivalsResponse(List<ProductInfo> products, String message) {
    }

    public record GetProductsByCategoryRequest(String categoryName, Integer limit) {
    }

    public record GetProductsByCategoryResponse(List<ProductInfo> products, String categoryName, String message) {
    }

    public record GetCategoriesRequest() {
    }

    public record GetCategoriesResponse(List<CategoryInfo> categories, String message) {
    }

    public record ProductInfo(
            String id,
            String name,
            String price,
            String originalPrice,
            String discountPercent,
            String categoryName,
            String imageUrl,
            String createdAt) {
    }

    public record CategoryInfo(
            String id,
            String name,
            String description,
            int productCount) {
    }

    // ============ Tool Functions ============

    /**
     * Lấy danh sách sản phẩm trending (giảm giá cao)
     */
    @Bean
    @Description("Get trending products with high discounts. Use when user asks about trending or hot products.")
    public Function<GetTrendingProductsRequest, GetTrendingProductsResponse> getTrendingProducts() {
        return request -> {
            log.info("=== Tool called: getTrendingProducts(limit={}) ===", request.limit());

            try {
                int limit = request.limit() != null ? request.limit() : 10;

                // Tạm thời lấy sản phẩm có discount cao nhất (giả định là trending)
                Page<Product> allProducts = productService.getAllProducts(1, 100);

                List<ProductInfo> trendingProducts = allProducts.getContent().stream()
                        .filter(p -> p.getDiscountPercent() > 0)
                        .sorted((p1, p2) -> Double.compare(p2.getDiscountPercent(), p1.getDiscountPercent()))
                        .limit(limit)
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                if (trendingProducts.isEmpty()) {
                    // Fallback: lấy sản phẩm mới nhất
                    trendingProducts = allProducts.getContent().stream()
                            .limit(limit)
                            .map(this::toProductInfo)
                            .collect(Collectors.toList());
                }

                // Store products in ThreadLocal for carousel
                List<ProductSuggestionDto> productDtos = allProducts.getContent().stream()
                        .filter(p -> p.getDiscountPercent() > 0)
                        .sorted((p1, p2) -> Double.compare(p2.getDiscountPercent(), p1.getDiscountPercent()))
                        .limit(limit)
                        .map(p -> ProductSuggestionDto.builder()
                                .id(p.getId())
                                .name(p.getName())
                                .description(p.getDescription())
                                .price(p.getPrice())
                                .originalPrice(p.getOriginalPrice())
                                .discountPercent(p.getDiscountPercent())
                                .status(ProductStatus.IN_STOCK.name())
                                .imageUrl(p.getImageId())
                                .build())
                        .collect(Collectors.toList());

                if (productDtos.isEmpty()) {
                    productDtos = allProducts.getContent().stream()
                            .limit(limit)
                            .map(p -> ProductSuggestionDto.builder()
                                    .id(p.getId())
                                    .name(p.getName())
                                    .description(p.getDescription())
                                    .price(p.getPrice())
                                    .originalPrice(p.getOriginalPrice())
                                    .discountPercent(p.getDiscountPercent())
                                    .status(ProductStatus.IN_STOCK.name())
                                    .imageUrl(p.getImageId())
                                    .build())
                            .collect(Collectors.toList());
                }

                LAST_PRODUCTS.set(productDtos);

                StringBuilder message = new StringBuilder();
                message.append("📈 **Sản phẩm đang trending:**\n\n");
                for (ProductInfo product : trendingProducts) {
                    message.append("• **").append(product.name()).append("**\n");
                    message.append("  - Giá: ").append(product.price());
                    if (product.discountPercent() != null) {
                        message.append(" (giảm ").append(product.discountPercent()).append(")");
                    }
                    message.append("\n");
                    if (product.categoryName() != null) {
                        message.append("  - Danh mục: ").append(product.categoryName()).append("\n");
                    }
                    message.append("\n");
                }

                log.info("Found {} trending products", trendingProducts.size());
                return new GetTrendingProductsResponse(trendingProducts, message.toString());

            } catch (Exception e) {
                log.error("Error getting trending products: ", e);
                LAST_PRODUCTS.remove();
                return new GetTrendingProductsResponse(
                        List.of(),
                        "Không thể lấy danh sách sản phẩm trending.");
            }
        };
    }

    /**
     * Lấy hàng mới về (sắp xếp theo ngày tạo)
     */
    @Bean
    @Description("Get newly arrived products. Use when user asks about new products or recent additions.")
    public Function<GetNewArrivalsRequest, GetNewArrivalsResponse> getNewArrivals() {
        return request -> {
            log.info("=== Tool called: getNewArrivals(days={}, limit={}) ===", request.days(), request.limit());

            try {
                int days = request.days() != null ? request.days() : 7;
                int limit = request.limit() != null ? request.limit() : 10;

                LocalDateTime cutoffDate = LocalDateTime.now().minusDays(days);

                // Lấy tất cả sản phẩm và filter theo ngày tạo
                Page<Product> allProducts = productService.getAllProducts(1, 100);

                List<ProductInfo> newProducts = allProducts.getContent().stream()
                        .filter(p -> p.getCreatedTimestamp() != null && p.getCreatedTimestamp().isAfter(cutoffDate))
                        .sorted((p1, p2) -> p2.getCreatedTimestamp().compareTo(p1.getCreatedTimestamp()))
                        .limit(limit)
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                // Store products in ThreadLocal for carousel
                List<ProductSuggestionDto> productDtos = allProducts.getContent().stream()
                        .filter(p -> p.getCreatedTimestamp() != null && p.getCreatedTimestamp().isAfter(cutoffDate))
                        .sorted((p1, p2) -> p2.getCreatedTimestamp().compareTo(p1.getCreatedTimestamp()))
                        .limit(limit)
                        .map(p -> ProductSuggestionDto.builder()
                                .id(p.getId())
                                .name(p.getName())
                                .description(p.getDescription())
                                .price(p.getPrice())
                                .originalPrice(p.getOriginalPrice())
                                .discountPercent(p.getDiscountPercent())
                                .status(ProductStatus.IN_STOCK.name())
                                .imageUrl(p.getImageId())
                                .build())
                        .collect(Collectors.toList());

                LAST_PRODUCTS.set(productDtos);

                StringBuilder message = new StringBuilder();
                if (newProducts.isEmpty()) {
                    message.append("Không có sản phẩm mới trong ").append(days).append(" ngày gần đây.");
                } else {
                    message.append("🆕 **Sản phẩm mới trong ").append(days).append(" ngày:**\n\n");
                    for (ProductInfo product : newProducts) {
                        message.append("• **").append(product.name()).append("**\n");
                        message.append("  - Giá: ").append(product.price()).append("\n");
                        if (product.createdAt() != null) {
                            message.append("  - Ngày thêm: ").append(product.createdAt()).append("\n");
                        }
                        message.append("\n");
                    }
                }

                log.info("Found {} new products in last {} days", newProducts.size(), days);
                return new GetNewArrivalsResponse(newProducts, message.toString());

            } catch (Exception e) {
                log.error("Error getting new arrivals: ", e);
                LAST_PRODUCTS.remove();
                return new GetNewArrivalsResponse(
                        List.of(),
                        "Không thể lấy danh sách sản phẩm mới.");
            }
        };
    }

    /**
     * Lấy sản phẩm theo danh mục
     */
    @Bean
    @Description("Get products by category. Use when user wants to browse a specific category.")
    public Function<GetProductsByCategoryRequest, GetProductsByCategoryResponse> getProductsByCategory() {
        return request -> {
            log.info("=== Tool called: getProductsByCategory(category={}, limit={}) ===",
                    request.categoryName(), request.limit());

            if (request.categoryName() == null || request.categoryName().isBlank()) {
                return new GetProductsByCategoryResponse(
                        List.of(),
                        null,
                        "Vui lòng cung cấp tên danh mục.");
            }

            try {
                int limit = request.limit() != null ? request.limit() : 10;

                // Tìm category theo tên
                List<Category> categories = categoryRepository.findAll();
                Category matchedCategory = categories.stream()
                        .filter(cat -> cat.getName().toLowerCase().contains(request.categoryName().toLowerCase()))
                        .findFirst()
                        .orElse(null);

                if (matchedCategory == null) {
                    return new GetProductsByCategoryResponse(
                            List.of(),
                            request.categoryName(),
                            "Không tìm thấy danh mục '" + request.categoryName() + "'.");
                }

                // Lấy sản phẩm trong category
                Page<Product> allProducts = productService.getAllProducts(1, 100);
                List<ProductInfo> categoryProducts = allProducts.getContent().stream()
                        .filter(p -> p.getCategory() != null && p.getCategory().getId().equals(matchedCategory.getId()))
                        .limit(limit)
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                // Store products in ThreadLocal for carousel
                List<ProductSuggestionDto> productDtos = allProducts.getContent().stream()
                        .filter(p -> p.getCategory() != null && p.getCategory().getId().equals(matchedCategory.getId()))
                        .limit(limit)
                        .map(p -> ProductSuggestionDto.builder()
                                .id(p.getId())
                                .name(p.getName())
                                .description(p.getDescription())
                                .price(p.getPrice())
                                .originalPrice(p.getOriginalPrice())
                                .discountPercent(p.getDiscountPercent())
                                .status(ProductStatus.IN_STOCK.name())
                                .imageUrl(p.getImageId())
                                .build())
                        .collect(Collectors.toList());

                LAST_PRODUCTS.set(productDtos);

                StringBuilder message = new StringBuilder();
                message.append("🏷️ **Sản phẩm trong '").append(matchedCategory.getName()).append("':**\n\n");
                if (categoryProducts.isEmpty()) {
                    message.append("Chưa có sản phẩm nào trong danh mục này.");
                } else {
                    for (ProductInfo product : categoryProducts) {
                        message.append("• **").append(product.name()).append("**\n");
                        message.append("  - Giá: ").append(product.price()).append("\n\n");
                    }
                }

                log.info("Found {} products in category {}", categoryProducts.size(), matchedCategory.getName());
                return new GetProductsByCategoryResponse(
                        categoryProducts,
                        matchedCategory.getName(),
                        message.toString());

            } catch (Exception e) {
                log.error("Error getting products by category: ", e);
                LAST_PRODUCTS.remove();
                return new GetProductsByCategoryResponse(
                        List.of(),
                        request.categoryName(),
                        "Không thể lấy sản phẩm theo danh mục.");
            }
        };
    }

    /**
     * Lấy danh sách tất cả categories
     */
    @Bean
    @Description("Get all available product categories. Use when user asks what categories exist.")
    public Function<GetCategoriesRequest, GetCategoriesResponse> getCategories() {
        return request -> {
            log.info("=== Tool called: getCategories() ===");

            try {
                List<Category> categories = categoryRepository.findAll();

                // Get product count for each category
                Page<Product> allProducts = productService.getAllProducts(1, 1000);

                List<CategoryInfo> categoryInfos = categories.stream()
                        .map(cat -> {
                            int productCount = (int) allProducts.getContent().stream()
                                    .filter(p -> p.getCategory() != null && p.getCategory().getId().equals(cat.getId()))
                                    .count();

                            return new CategoryInfo(
                                    cat.getId(),
                                    cat.getName(),
                                    cat.getDescription(),
                                    productCount);
                        })
                        .collect(Collectors.toList());

                StringBuilder message = new StringBuilder();
                message.append("📂 **Danh mục sản phẩm:**\n\n");
                for (CategoryInfo cat : categoryInfos) {
                    message.append("• **").append(cat.name()).append("**");
                    if (cat.productCount() > 0) {
                        message.append(" (").append(cat.productCount()).append(" sản phẩm)");
                    }
                    message.append("\n");
                    if (cat.description() != null && !cat.description().isBlank()) {
                        message.append("  ").append(cat.description()).append("\n");
                    }
                    message.append("\n");
                }

                log.info("Found {} categories", categoryInfos.size());
                return new GetCategoriesResponse(categoryInfos, message.toString());

            } catch (Exception e) {
                log.error("Error getting categories: ", e);
                return new GetCategoriesResponse(
                        List.of(),
                        "Không thể lấy danh sách danh mục.");
            }
        };
    }

    // ============ Helper Methods ============

    private ProductInfo toProductInfo(Product product) {
        String categoryName = product.getCategory() != null ? product.getCategory().getName() : null;
        String createdAt = product.getCreatedTimestamp() != null
                ? product.getCreatedTimestamp().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                : null;

        return new ProductInfo(
                product.getId(),
                product.getName(),
                formatPrice(product.getPrice()),
                formatPrice(product.getOriginalPrice()),
                product.getDiscountPercent() > 0 ? product.getDiscountPercent() + "%" : null,
                categoryName,
                product.getImageId(),
                createdAt);
    }

    private String formatPrice(Double price) {
        if (price == null || price == 0)
            return "0₫";
        return String.format("%,.0f₫", price);
    }
}
