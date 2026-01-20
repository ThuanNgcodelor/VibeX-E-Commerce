package com.example.stockservice.controller;

import com.example.stockservice.dto.BatchDecreaseStockRequest;
import com.example.stockservice.dto.BatchGetProductsRequest;
import com.example.stockservice.dto.ProductDto;
import com.example.stockservice.jwt.JwtUtil;
import com.example.stockservice.dto.SizeDto;
import com.example.stockservice.model.FlashSaleProduct;

import com.example.stockservice.model.Product;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.ReviewRepository;
import com.example.stockservice.request.product.DecreaseStockRequest;
import com.example.stockservice.request.product.IncreaseStockRequest;
import com.example.stockservice.request.product.ProductCreateRequest;
import com.example.stockservice.request.product.ProductUpdateRequest;
import com.example.stockservice.service.flashsale.FlashSaleService;
import com.example.stockservice.service.product.ProductService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RequestMapping("/v1/stock/product")
@RequiredArgsConstructor
@RestController
public class ProductController {
    private final ProductService productService;
    private final ModelMapper modelMapper;
    private final ReviewRepository reviewRepository;
    private final JwtUtil jwtUtil;
    private final FlashSaleService flashSaleService;
    private final ObjectMapper objectMapper;

    @GetMapping("/public/shop/{shopId}/stats")
    public ResponseEntity<java.util.Map<String, Object>> getShopStats(@PathVariable String shopId) {
        long productCount = productService.countProductsByUserId(shopId);
        Double avgRating = reviewRepository.getAverageRatingByShopId(shopId);
        long totalReviews = reviewRepository.countReviewsByShopId(shopId);
        long visibleReviews = reviewRepository.countVisibleReviewsByShopId(shopId);
        long repliedReviews = reviewRepository.countRepliedReviewsByShopId(shopId);

        int responseRate = 0;
        if (visibleReviews > 0) {
            responseRate = (int) Math.round(((double) repliedReviews / visibleReviews) * 100);
        }

        java.util.List<com.example.stockservice.model.Review> repliedReviewsList = reviewRepository
                .findRepliedReviewsByShopId(shopId);
        double avgSeconds = repliedReviewsList.stream()
                .filter(r -> r.getRepliedAt() != null && r.getCreatedAt() != null)
                .mapToLong(r -> java.time.Duration.between(r.getCreatedAt(), r.getRepliedAt()).getSeconds())
                .average()
                .orElse(0);

        String responseTime = "N/A";
        if (repliedReviews > 0 && avgSeconds > 0) {
            long minutes = Math.round(avgSeconds / 60);
            if (minutes < 60) {
                responseTime = Math.max(1, minutes) + " minutes";
            } else if (minutes < 1440) {
                responseTime = Math.round(minutes / 60.0) + " hours";
            } else {
                responseTime = Math.round(minutes / 1440.0) + " days";
            }
        }

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("productCount", productCount);
        response.put("avgRating", avgRating != null ? avgRating : 0.0);
        response.put("responseRate", responseRate);
        response.put("totalReviews", totalReviews);
        response.put("responseTime", responseTime);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/shop-owner/stats")
    public ResponseEntity<java.util.Map<String, Object>> getShopStatsForOwner(HttpServletRequest request) {
        String shopId = jwtUtil.ExtractUserId(request);
        long totalProducts = productService.countProductsByUserId(shopId);
        long bannedProducts = productService.countProductsByUserIdAndStatus(shopId,
                com.example.stockservice.enums.ProductStatus.BANNED);
        long suspendedProducts = productService.countProductsByUserIdAndStatus(shopId,
                com.example.stockservice.enums.ProductStatus.SUSPENDED);
        long outOfStockProducts = productService.countProductsByUserIdAndStatus(shopId,
                com.example.stockservice.enums.ProductStatus.OUT_OF_STOCK);

        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("totalProducts", totalProducts);
        response.put("bannedProducts", bannedProducts); // Granular
        response.put("suspendedProducts", suspendedProducts); // Granular
        response.put("lockedProducts", bannedProducts + suspendedProducts); // Legacy/Aggregated
        response.put("outOfStockProducts", outOfStockProducts);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/public/shop/{shopId}/products")
    public ResponseEntity<Page<ProductDto>> getShopProductsPublic(
            @PathVariable String shopId,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "20") Integer pageSize) {

        Page<ProductDto> products = productService.getProductsByUserIdWithPaging(shopId, pageNo, pageSize)
                .map(this::toDto);

        return ResponseEntity.ok(products);
    }

    @PostMapping("/decreaseStock")
    public ResponseEntity<ProductDto> decreaseStock(@Valid @RequestBody DecreaseStockRequest request) {
        productService.decreaseStockBySize(request.getSizeId(), request.getQuantity());

        // Get product by finding the size first
        Product product = productService.findProductBySizeId(request.getSizeId());

        if (product == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        ProductDto productDto = toDto(product);
        return ResponseEntity.status(HttpStatus.OK).body(productDto);
    }

    @PostMapping("/increaseStock")
    public ResponseEntity<ProductDto> increaseStock(@Valid @RequestBody IncreaseStockRequest request) {
        productService.increaseStockBySize(request.getSizeId(), request.getQuantity());

        // Get product by finding the size first
        Product product = productService.findProductBySizeId(request.getSizeId());

        if (product == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        ProductDto productDto = toDto(product);
        return ResponseEntity.status(HttpStatus.OK).body(productDto);
    }

    @PostMapping("/restoreStock")
    public ResponseEntity<?> restoreStock(
            @Valid @RequestBody com.example.stockservice.dto.RestoreStockRequest request) {
        try {
            productService.restoreStockForCancellation(
                    request.getProductId(),
                    request.getSizeId(),
                    request.getQuantity());
            return ResponseEntity.ok(java.util.Map.of(
                    "success", true,
                    "message", "Stock restored successfully to Redis + DB"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(java.util.Map.of(
                    "success", false,
                    "message", e.getMessage()));
        }
    }

    // {
    // "name": "Điện thoại iPhone 15 Pro",
    // "description": "Điện thoại cao cấp với chip A17 Bionic, màn hình 6.1 inch
    // Super Retina XDR. Camera 48MP với zoom quang học 3x. Pin lithium-ion với
    // MagSafe.",
    // "price": 28990000,
    // "originalPrice": 32990000,
    // "discountPercent": 12.1,
    // "categoryId": "1",
    // "sizes": [
    // {
    // "name": "128GB",
    // "description": "Bộ nhớ 128GB",
    // "stock": 50,
    // "priceModifier": 0
    // },
    // {
    // "name": "256GB",
    // "description": "Bộ nhớ 256GB",
    // "stock": 30,
    // "priceModifier": 4000000
    // },
    // {
    // "name": "512GB",
    // "description": "Bộ nhớ 512GB",
    // "stock": 20,
    // "priceModifier": 8000000
    // }
    // ]
    // }
    @PostMapping("/create")
    ResponseEntity<ProductDto> createProduct(@Valid @RequestPart("request") ProductCreateRequest request,
            @RequestPart(value = "file", required = false) MultipartFile[] files,
            HttpServletRequest httpServletRequest) {
        String userId = jwtUtil.ExtractUserId(httpServletRequest);
        request.setUserId(userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toDto(productService.createProduct(request, files)));
    }

    @PutMapping("/update")
    ResponseEntity<ProductDto> updateProduct(@Valid @RequestPart("request") ProductUpdateRequest request,
            @RequestPart(value = "file", required = false) MultipartFile[] files,
            HttpServletRequest httpServletRequest) {
        String userId = jwtUtil.ExtractUserId(httpServletRequest);
        request.setUserId(userId);
        return ResponseEntity.status(HttpStatus.OK)
                .body(toDto(productService.updateProduct(request, files)));
    }

    @DeleteMapping("/deleteProductById/{id}")
    ResponseEntity<ProductDto> deleteProductById(@PathVariable String id) {
        productService.deleteProduct(id);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    @GetMapping("/getProductById/{id}")
    ResponseEntity<ProductDto> getProductById(@PathVariable String id) {
        return ResponseEntity.status(HttpStatus.OK)
                .body(toDto(productService.getProductById(id)));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<ProductDto>> searchProducts(
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "6") Integer pageSize) {

        Page<Product> products = productService.searchProductByKeyword(keyword, pageNo, pageSize);
        Page<ProductDto> dtoPage = products.map(this::toDto);
        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/listPage")
    ResponseEntity<Page<ProductDto>> getAllProducts(
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "6") Integer pageSize) {
        Page<ProductDto> products = productService.getAllProducts(pageNo, pageSize).map(this::toDto);
        return ResponseEntity.status(HttpStatus.OK).body(products);
    }

    @GetMapping("/list")
    ResponseEntity<List<ProductDto>> getAllProduct() {
        return ResponseEntity.ok(productService.getAllProducts().stream()
                .map(this::toDto).toList());
    }

    @GetMapping("/listPageShopOwner")
    ResponseEntity<Page<ProductDto>> getAllProductsByShopOwner(
            HttpServletRequest httpServletRequest,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "6") Integer pageSize) {

        String userId = jwtUtil.ExtractUserId(httpServletRequest);
        Page<ProductDto> products = productService.getProductsByUserIdWithPaging(userId, pageNo, pageSize)
                .map(this::toDto);

        return ResponseEntity.status(HttpStatus.OK).body(products);
    }

    @GetMapping("/searchShopOwner")
    public ResponseEntity<Page<ProductDto>> searchProductsByShopOwner(
            HttpServletRequest httpServletRequest,
            @RequestParam(required = false, defaultValue = "") String keyword,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "6") Integer pageSize) {

        String userId = jwtUtil.ExtractUserId(httpServletRequest);
        Page<Product> products = productService.searchProductsByUserId(userId, keyword, pageNo, pageSize);
        Page<ProductDto> dtoPage = products.map(this::toDto);

        return ResponseEntity.ok(dtoPage);
    }

    @GetMapping("/shop-owner/{userId}/ids")
    ResponseEntity<List<String>> getProductIdsByShopOwner(@PathVariable String userId) {
        List<Product> products = productService.getAllProductsByUserId(userId);
        List<String> productIds = products.stream()
                .map(Product::getId)
                .collect(Collectors.toList());
        return ResponseEntity.ok(productIds);
    }

    @GetMapping("/ids/by-category")
    public ResponseEntity<List<String>> getProductIdsByCategoryName(@RequestParam String name) {
        List<String> ids = productService.getProductIdsByCategoryName(name);
        return ResponseEntity.ok(ids);
    }

    @GetMapping("/internal/count/shop/{shopId}")
    public ResponseEntity<Long> getShopProductCount(@PathVariable String shopId) {
        return ResponseEntity.ok(productService.countProductsByUserId(shopId));
    }

    @GetMapping("/internal/category-stats/shop/{shopId}")
    public ResponseEntity<List<java.util.Map<String, Object>>> getShopCategoryStats(@PathVariable String shopId) {
        List<Object[]> stats = productService.getProductsByCategory(shopId);
        List<java.util.Map<String, Object>> result = stats.stream().map(row -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("categoryName", row[0]);
            map.put("count", row[1]);
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ==================== BATCH API ENDPOINTS ====================

    /**
     * Batch get products by IDs
     * Optimized for Order Service to fetch multiple products in one call
     * 
     * @param request List of product IDs
     * @return Map of productId -> ProductDto
     */
    @PostMapping("/batch-get")
    public ResponseEntity<Map<String, ProductDto>> batchGetProducts(
            @RequestBody BatchGetProductsRequest request) {
        Map<String, ProductDto> result = productService.batchGetProducts(request.getProductIds());
        return ResponseEntity.ok(result);
    }

    /**
     * Batch decrease stock for multiple products
     * Optimized for Order Service to process multiple items in one transaction
     * 
     * @param request List of items with productId, sizeId, quantity
     * @return Map of productId -> success/failure
     */
    @PostMapping("/batch-decrease")
    public ResponseEntity<Map<String, Boolean>> batchDecreaseStock(
            @RequestBody BatchDecreaseStockRequest request) {
        Map<String, Boolean> result = productService.batchDecreaseStock(request.getItems());
        return ResponseEntity.ok(result);
    }

    private ProductDto toDto(Product product) {
        ProductDto dto = modelMapper.map(product, ProductDto.class);
        if (product.getCategory() != null) {
            dto.setCategoryName(product.getCategory().getName());
            dto.setCategoryId(product.getCategory().getId());
        }
        dto.setCreatedAt(product.getCreatedTimestamp());
        int total = 0;
        if (product.getSizes() != null) {
            for (Size s : product.getSizes()) {
                total += (s.getStock() != 0 ? s.getStock() : 0);
            }
        }
        dto.setTotalStock(total);

        // Deserialize attributeJson
        if (product.getAttributeJson() != null) {
            try {
                Map<String, String> attributes = objectMapper.readValue(product.getAttributeJson(),
                        new TypeReference<>() {
                        });
                dto.setAttributes(attributes);
            } catch (Exception e) {
                // Ignore parsing errors or log them
            }
        }

        try {
            FlashSaleProduct fsProduct = flashSaleService
                    .findActiveFlashSaleProduct(product.getId());
            if (fsProduct != null) {
                // Check stock availability
                int remaining = fsProduct.getFlashSaleStock() - fsProduct.getSoldCount();
                dto.setSoldCount(fsProduct.getSoldCount());

                if (remaining > 0) {
                    dto.setPrice(fsProduct.getSalePrice());
                    dto.setOriginalPrice(fsProduct.getOriginalPrice());
                    // Calculate discount percent: (1 - sale/original) * 100
                    if (fsProduct.getOriginalPrice() > 0) {
                        double discount = (1 - (fsProduct.getSalePrice() / fsProduct.getOriginalPrice())) * 100;
                        dto.setDiscountPercent(Math.round(discount * 10.0) / 10.0); // Round to 1 decimal
                    }
                    dto.setFlashSaleRemaining(remaining);

                    // Map specific size prices AND stock
                    if (dto.getSizes() != null && fsProduct.getProductSizes() != null) {
                        for (SizeDto sDto : dto.getSizes()) {
                            fsProduct.getProductSizes().stream()
                                    .filter(fpSize -> fpSize.getSizeId().equals(sDto.getId()))
                                    .findFirst()
                                    .ifPresent(fpSize -> {
                                        sDto.setFlashSalePrice(fpSize.getFlashSalePrice());
                                        // flashSaleStock now represents actual remaining stock (already decremented)
                                        sDto.setFlashSaleStock(fpSize.getFlashSaleStock());
                                    });
                        }
                    }
                }
            }
        } catch (Exception e) {
            // Ignore if flash sale check fails to avoid breaking main flow
        }

        return dto;
    }
}