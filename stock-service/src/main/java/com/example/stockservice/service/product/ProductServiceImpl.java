package com.example.stockservice.service.product;

import com.example.stockservice.client.FileStorageClient;
import com.example.stockservice.dto.BatchDecreaseStockRequest;
import com.example.stockservice.dto.ProductDto;
import com.example.stockservice.dto.SizeDto;
import com.example.stockservice.enums.InventoryLogType;
import com.example.stockservice.request.SendNotificationRequest;
import com.example.stockservice.service.category.CategoryService;
import org.springframework.data.domain.Pageable;
import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.request.product.ProductCreateRequest;
import com.example.stockservice.request.product.ProductUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.SizeRepository;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {
    private final com.example.stockservice.client.UserServiceClient userServiceClient;
    private final com.example.stockservice.repository.CartItemRepository cartItemRepository;

    @Override
    public long countProductsByUserId(String userId) {
        return productRepository.countByUserId(userId);
    }

    @Override
    public long countProductsByUserIdAndStatus(String userId, ProductStatus status) {
        return productRepository.countByUserIdAndStatus(userId, status);
    }

    private final CategoryService categoryService;
    private final ProductRepository productRepository;
    private final FileStorageClient fileStorageClient;
    private final SizeRepository sizeRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final org.springframework.kafka.core.KafkaTemplate<String, com.example.stockservice.event.ProductUpdateKafkaEvent> kafkaTemplate;
    // Generic KafkaTemplate for notifications
    private final org.springframework.kafka.core.KafkaTemplate<String, Object> genericKafkaTemplate;

    private final InventoryService inventoryService;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    @org.springframework.beans.factory.annotation.Value("${kafka.topic.product-updates}")
    private String productUpdatesTopic;

    @org.springframework.beans.factory.annotation.Value("${kafka.topic.notification}")
    private String notificationTopic;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void decreaseStockBySize(String sizeId, int quantity) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));

        if (size.getStock() < quantity) {
            throw new RuntimeException("Insufficient stock for size: " + size.getName() + ". Available: "
                    + size.getStock() + ", Requested: " + quantity);
        }

        size.setStock(size.getStock() - quantity);
        sizeRepository.save(size);

        // Update product status
        checkAndUpdateProductStatus(size.getProduct());

        // Inventory Log
        try {
            inventoryService.logStockChange(
                    size.getProduct().getId(),
                    sizeId,
                    -quantity,
                    size.getProduct().getUserId(),
                    com.example.stockservice.enums.InventoryLogType.ORDER,
                    "Order placement");
        } catch (Exception e) {
            // Log error but don't fail transaction
            System.err.println("Failed to log inventory change: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public void increaseStockBySize(String sizeId, int quantity) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));

        size.setStock(size.getStock() + quantity);
        sizeRepository.save(size);

        // Update product status
        checkAndUpdateProductStatus(size.getProduct());

        // Inventory Log
        try {
            inventoryService.logStockChange(
                    size.getProduct().getId(),
                    sizeId,
                    quantity,
                    size.getProduct().getUserId(),
                    com.example.stockservice.enums.InventoryLogType.CANCEL,
                    "Order cancelled/returned");
        } catch (Exception e) {
            System.err.println("Failed to log inventory change: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public void restoreStockForCancellation(String productId, String sizeId, int quantity) {
        // 1. Update DB
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found: " + sizeId));

        size.setStock(size.getStock() + quantity);
        sizeRepository.save(size);

        // 2. Update Redis cache
        String stockKey = "stock:" + productId + ":" + sizeId;
        try {
            stringRedisTemplate.opsForValue().increment(stockKey, quantity);
            System.out.println("[RESTORE] ✅ Redis stock restored: " + stockKey + " +" + quantity);
        } catch (Exception e) {
            System.err.println("[RESTORE] ⚠️ Failed to update Redis (will sync on next read): " + e.getMessage());
        }

        // 3. Update product status
        checkAndUpdateProductStatus(size.getProduct());

        // 4. Log inventory change
        try {
            inventoryService.logStockChange(
                    productId,
                    sizeId,
                    quantity,
                    size.getProduct().getUserId(),
                    InventoryLogType.CANCEL,
                    "Order cancelled - stock restored to Redis + DB");
        } catch (Exception e) {
            System.err.println("Failed to log inventory change: " + e.getMessage());
        }

        System.out.println("[RESTORE] ✅ Stock restored successfully: product=" + productId + ", size=" + sizeId
                + ", qty=" + quantity);
    }

    private void checkAndUpdateProductStatus(Product product) {
        // Use direct DB count to ensure data consistency
        if (product.getId() == null)
            return;

        long positiveStockCount = sizeRepository.countByProductIdAndStockGreaterThan(product.getId(), 0);
        boolean allOutOfStock = (positiveStockCount == 0);

        if (allOutOfStock) {
            if (product.getStatus() != ProductStatus.BANNED && product.getStatus() != ProductStatus.SUSPENDED) {
                if (product.getStatus() != ProductStatus.OUT_OF_STOCK) {
                    product.setStatus(ProductStatus.OUT_OF_STOCK);
                    productRepository.save(product);
                }
            }
        } else {
            if (product.getStatus() == ProductStatus.OUT_OF_STOCK) {
                product.setStatus(ProductStatus.IN_STOCK);
                productRepository.save(product);
            }
        }

        // CHECK LOW STOCK for Notification
        // Calculate total stock
        List<Size> sizes = sizeRepository.findByProductId(product.getId());
        int totalStock = sizes.stream().mapToInt(Size::getStock).sum();

        // Threshold = 10 (hardcoded for now as per requirement/plan)
        if (totalStock <= 10) {
            sendLowStockNotification(product, totalStock);
        }
    }

    private void sendLowStockNotification(Product product, int totalStock) {
        try {
            SendNotificationRequest notificationRequest = com.example.stockservice.request.SendNotificationRequest
                    .builder()
                    .userId(product.getUserId()) // Shop Owner ID
                    .shopId(product.getUserId()) // Shop ID is usually same as Owner ID in this context
                    .message("Cảnh báo: Sản phẩm '" + product.getName() + "' sắp hết hàng! Hiện còn: " + totalStock)
                    .isShopOwnerNotification(true)
                    .build();

            genericKafkaTemplate.send(notificationTopic, notificationRequest);
            // System.out.println("Sent low stock notification for product: " +
            // product.getName());
        } catch (Exception e) {
            System.err.println("Failed to send low stock notification: " + e.getMessage());
        }
    }

    @Override
    public Product findProductBySizeId(String sizeId) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));
        return size.getProduct();
    }

    @Override
    public Product createProduct(ProductCreateRequest request, MultipartFile[] files) {
        // Check if shop is active
        checkShopStatus(request.getUserId());

        String imageId = request.getImageId();
        List<String> imageIds = new ArrayList<>();

        // Upload multiple files if provided
        if (files != null && files.length > 0) {
            for (MultipartFile file : files) {
                if (file != null && !file.isEmpty()) {
                    try {
                        String uploadedId = fileStorageClient.uploadImageToFIleSystem(file).getBody();
                        if (uploadedId != null) {
                            imageIds.add(uploadedId);
                            // First image becomes main imageId (backward compatibility)
                            if (imageId == null) {
                                imageId = uploadedId;
                            }
                        }
                    } catch (Exception e) {
                        // Continue with other files if one fails
                    }
                }
            }
        }

        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .originalPrice(request.getOriginalPrice())
                .discountPercent(request.getDiscountPercent())
                .status(ProductStatus.IN_STOCK)
                .category(categoryService.findCategoryById(request.getCategoryId()))
                .imageId(imageId)
                .userId(request.getUserId())
                .build();

        if (request.getAttributes() != null) {
            try {
                String json = objectMapper.writeValueAsString(request.getAttributes());
                product.setAttributeJson(json);
            } catch (Exception e) {
                // Handle
            }
        }

        if (!imageIds.isEmpty()) {
            product.setImageIds(imageIds);
        }

        product = productRepository.save(product);

        // CREATE SIZES if provided
        if (request.getSizes() != null && !request.getSizes().isEmpty()) {
            final Product savedProduct = product; // Final reference for lambda
            List<Size> sizes = request.getSizes().stream()
                    .map(sizeRequest -> Size.builder()
                            .name(sizeRequest.getName())
                            .description(sizeRequest.getDescription())
                            .stock(sizeRequest.getStock())
                            .priceModifier(sizeRequest.getPriceModifier())
                            .weight(sizeRequest.getWeight() != null ? sizeRequest.getWeight() : 500) // Default 500g if
                            .product(savedProduct)
                            .build())
                    .collect(Collectors.toList());

            sizeRepository.saveAll(sizes);
            product.setSizes(sizes);
        }

        return product;
    }

    @Override
    public Product updateProduct(ProductUpdateRequest request, MultipartFile[] files) {
        Product toUpdate = findProductById(request.getId());

        // Check if shop is active
        checkShopStatus(toUpdate.getUserId());

        if (request.getName() != null) {
            toUpdate.setName(request.getName());
        }
        if (request.getDescription() != null) {
            toUpdate.setDescription(request.getDescription());
        }
        if (request.getPrice() != 0) {
            toUpdate.setPrice(request.getPrice());
        }
        if (request.getOriginalPrice() != 0) {
            toUpdate.setOriginalPrice(request.getOriginalPrice());
        }
        toUpdate.setDiscountPercent(request.getDiscountPercent());

        if (request.getCategoryId() != null) {
            toUpdate.setCategory(categoryService.findCategoryById(request.getCategoryId()));
        }

        if (request.getStatus() != null) {
            toUpdate.setStatus(ProductStatus.valueOf(request.getStatus()));
        }

        if (request.getAttributes() != null) {
            try {
                String json = objectMapper.writeValueAsString(request.getAttributes());
                toUpdate.setAttributeJson(json);
            } catch (Exception e) {
                // Handle
            }
        }

        // Upload new files if provided
        if (files != null && files.length > 0) {
            List<String> newImageIds = new ArrayList<>();
            String newMainImageId = null;

            for (MultipartFile file : files) {
                if (file != null && !file.isEmpty()) {
                    try {
                        String uploadedId = fileStorageClient.uploadImageToFIleSystem(file).getBody();
                        if (uploadedId != null) {
                            newImageIds.add(uploadedId);
                            if (newMainImageId == null) {
                                newMainImageId = uploadedId;
                            }
                        }
                    } catch (Exception e) {
                        // Continue with other files if one fails
                    }
                }
            }

            if (!newImageIds.isEmpty()) {
                // Delete old images if replacing
                if (toUpdate.getImageIds() != null) {
                    for (String oldId : toUpdate.getImageIds()) {
                        try {
                            fileStorageClient.deleteImageFromFileSystem(oldId);
                        } catch (Exception e) {
                            // Continue if deletion fails
                        }
                    }
                }
                if (toUpdate.getImageId() != null && !newImageIds.contains(toUpdate.getImageId())) {
                    try {
                        fileStorageClient.deleteImageFromFileSystem(toUpdate.getImageId());
                    } catch (Exception e) {
                        // Continue if deletion fails
                    }
                }

                toUpdate.setImageIds(newImageIds);
                if (newMainImageId != null) {
                    toUpdate.setImageId(newMainImageId);
                }
            }
        }

        if (request.getSizes() != null) {
            List<Size> managedSizes = toUpdate.getSizes();
            if (managedSizes != null && !managedSizes.isEmpty()) {

                for (Size size : managedSizes) {
                    if (size.getCartItems() != null) {
                        for (com.example.stockservice.model.CartItem cartItem : size.getCartItems()) {
                            cartItem.setSize(null);
                            cartItemRepository.save(cartItem);
                        }
                    }
                }
                managedSizes.clear();
            }

            if (!request.getSizes().isEmpty()) {
                List<Size> newSizes = request.getSizes().stream()
                        .map(sizeRequest -> Size.builder()
                                .name(sizeRequest.getName())
                                .description(sizeRequest.getDescription())
                                .stock(sizeRequest.getStock())
                                .priceModifier(sizeRequest.getPriceModifier())
                                .weight(sizeRequest.getWeight() != null ? sizeRequest.getWeight() : 500) // Default 500g
                                .product(toUpdate)
                                .build())
                        .collect(Collectors.toList());
                if (managedSizes == null) {
                    toUpdate.setSizes(newSizes);
                } else {
                    managedSizes.addAll(newSizes);
                }
            }
        }

        Product updatedProduct = productRepository.save(toUpdate);

        // Ensure status consistency based on stock
        checkAndUpdateProductStatus(updatedProduct);

        // Publish event to Kafka
        try {
            kafkaTemplate.send(productUpdatesTopic,
                    new com.example.stockservice.event.ProductUpdateKafkaEvent(updatedProduct.getId()));
        } catch (Exception e) {
            // Log error but don't fail the transaction
            // log.error("Failed to send Kafka event", e);
            System.err.println("Failed to send Kafka event: " + e.getMessage());
        }

        return updatedProduct;
    }

    @Override
    public Product getProductById(String id) {
        return findProductById(id);
    }

    @Override
    public Product findProductById(String id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Product not found with id: " + id));
    }

    @Override
    public void deleteProduct(String id) {
        productRepository.deleteById(id);
    }

    @Override
    public Page<Product> getAllProducts(Integer pageNo, Integer pageSize) {
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);
        return productRepository.findAllByStatus(ProductStatus.IN_STOCK, pageable);
    }

    protected Page<Product> fetchPageFromDB(String keyword, Integer pageNo, Integer pageSize) {
        List<Product> fullList = productRepository.searchProductByName(keyword);
        // Handle both 0-based and 1-based page numbers
        int actualPageNo = pageNo > 0 ? pageNo - 1 : Math.max(0, pageNo);
        Pageable pageable = PageRequest.of(actualPageNo, pageSize);
        return getProductsPage(pageable, fullList);
    }

    @Override
    public Page<Product> searchProductByKeyword(String keyword, Integer pageNo, Integer pageSize) {
        return fetchPageFromDB(keyword, pageNo, pageSize);
    }

    @Override
    public List<Product> getAllProducts() {
        return productRepository.findAllWithSizes();
    }

    public Page<Product> getProductsByUserId(String userId, Integer pageNo) {
        Pageable pageable = PageRequest.of(pageNo - 1, 10);
        List<Product> userProducts = productRepository.findByUserId(userId);

        return getProductsPage(pageable, userProducts);
    }

    public List<Product> getAllProductsByUserId(String userId) {
        return productRepository.findByUserId(userId);
    }

    @Override
    public Page<Product> getProductsByUserIdWithPaging(String userId, Integer pageNo, Integer pageSize) {
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);
        List<Product> userProducts = productRepository.findByUserId(userId);

        return getProductsPage(pageable, userProducts);
    }

    private Page<Product> getProductsPage(Pageable pageable, List<Product> userProducts) {
        int start = Math.min((int) pageable.getOffset(), userProducts.size());
        int end = Math.min(start + pageable.getPageSize(), userProducts.size());
        List<Product> pageList = userProducts.subList(start, end);

        return new PageImpl<>(pageList, pageable, userProducts.size());
    }

    @Override
    public Page<Product> searchProductsByUserId(String userId, String keyword, Integer pageNo, Integer pageSize) {
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);
        List<Product> allUserProducts = productRepository.findByUserId(userId);

        List<Product> filteredProducts = allUserProducts.stream()
                .filter(p -> p.getName().toLowerCase().contains(keyword.toLowerCase()))
                .collect(Collectors.toList());

        return getProductsPage(pageable, filteredProducts);
    }

    @Override
    public List<Object[]> getProductsByCategory(String userId) {
        return productRepository.countProductsByCategory(userId);
    }

    // ==================== BATCH API METHODS ====================

    /**
     * Batch fetch products by IDs
     * Optimized to fetch multiple products in a single DB query
     *
     * @param productIds List of product IDs to fetch
     * @return Map of productId -> ProductDto
     */
    @Override
    public java.util.Map<String, ProductDto> batchGetProducts(List<String> productIds) {
        if (productIds == null || productIds.isEmpty()) {
            return new java.util.HashMap<>();
        }

        // Single DB query for all products
        List<Product> products = productRepository.findAllByIdIn(productIds);

        // Convert to DTO and create Map for O(1) lookup
        return products.stream()
                .collect(java.util.stream.Collectors.toMap(
                        Product::getId,
                        product -> {
                            ProductDto dto = new ProductDto();
                            dto.setId(product.getId());
                            dto.setName(product.getName());
                            dto.setDescription(product.getDescription());
                            dto.setPrice(product.getPrice());
                            dto.setOriginalPrice(product.getOriginalPrice());
                            dto.setDiscountPercent(product.getDiscountPercent());
                            dto.setStatus(product.getStatus());
                            dto.setImageId(product.getImageId());
                            dto.setUserId(product.getUserId());
                            dto.setImageIds(product.getImageIds());

                            if (product.getCategory() != null) {
                                dto.setCategoryId(product.getCategory().getId());
                                dto.setCategoryName(product.getCategory().getName());
                            }

                            if (product.getSizes() != null) {
                                List<SizeDto> sizeDtos = product.getSizes().stream()
                                        .map(size -> {
                                            SizeDto sizeDto = new SizeDto();
                                            sizeDto.setId(size.getId());
                                            sizeDto.setName(size.getName());
                                            sizeDto.setDescription(size.getDescription());
                                            sizeDto.setStock(size.getStock());
                                            sizeDto.setPriceModifier(size.getPriceModifier());
                                            sizeDto.setWeight(size.getWeight());
                                            return sizeDto;
                                        })
                                        .collect(java.util.stream.Collectors.toList());
                                dto.setSizes(sizeDtos);
                            }

                            return dto;
                        }));
    }

    /**
     * Batch decrease stock for multiple products
     * Processes all items in a single transaction
     *
     * @param items List of items to decrease stock for
     * @return Map of productId -> success/failure
     */
    @Override
    @org.springframework.transaction.annotation.Transactional
    public java.util.Map<String, Boolean> batchDecreaseStock(
            List<BatchDecreaseStockRequest.DecreaseStockItem> items) {

        java.util.Map<String, Boolean> results = new java.util.HashMap<>();

        if (items == null || items.isEmpty()) {
            return results;
        }

        for (BatchDecreaseStockRequest.DecreaseStockItem item : items) {
            try {
                // Find size
                Size size = sizeRepository.findById(item.getSizeId())
                        .orElseThrow(() -> new RuntimeException("Size not found: " + item.getSizeId()));

                // Check stock
                if (size.getStock() < item.getQuantity()) {
                    results.put(item.getProductId(), false);
                    continue;
                }

                // Decrease stock
                size.setStock(size.getStock() - item.getQuantity());
                sizeRepository.save(size);

                // Update product status
                checkAndUpdateProductStatus(size.getProduct());

                // Inventory log
                try {
                    inventoryService.logStockChange(
                            item.getProductId(),
                            item.getSizeId(),
                            -item.getQuantity(),
                            size.getProduct().getUserId(),
                            InventoryLogType.ORDER,
                            "Batch order placement");
                } catch (Exception e) {
                    // Log error but don't fail transaction
                    System.err.println("Failed to log inventory change: " + e.getMessage());
                }

                results.put(item.getProductId(), true);

            } catch (Exception e) {
                System.err.println("Failed to decrease stock for product " +
                        item.getProductId() + ": " + e.getMessage());
                results.put(item.getProductId(), false);
            }
        }

        return results;
    }

    private void checkShopStatus(String userId) {
        try {
            org.springframework.http.ResponseEntity<com.example.stockservice.dto.ShopOwnerDto> response = userServiceClient
                    .getShopOwnerByUserId(userId);
            if (response != null && response.getBody() != null) {
                com.example.stockservice.dto.ShopOwnerDto shop = response.getBody();
                if ("INACTIVE".equalsIgnoreCase(shop.getActive())) {
                    throw new RuntimeException(
                            "SHOP_LOCKED: Your shop is currently locked. You cannot perform this action.");
                }
            }
        } catch (Exception e) {
            if (e.getMessage().contains("SHOP_LOCKED")) {
                throw e;
            }
            // Log error but allow operation to proceed if service is down, EXCEPT if
            // explicitly locked
            System.err.println("Failed to verify shop status: " + e.getMessage());
        }
    }
}