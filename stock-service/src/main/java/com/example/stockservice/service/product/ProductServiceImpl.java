package com.example.stockservice.service.product;

import com.example.stockservice.client.FileStorageClient;
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
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.SizeRepository;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {
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

    @Override
    public void decreaseStockBySize(String sizeId, int quantity) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));

        if (size.getStock() < quantity) {
            throw new RuntimeException("Insufficient stock for size: " + size.getName() + ". Available: "
                    + size.getStock() + ", Requested: " + quantity);
        }

        size.setStock(size.getStock() - quantity);
        sizeRepository.save(size);
    }

    @Override
    public void increaseStockBySize(String sizeId, int quantity) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));

        size.setStock(size.getStock() + quantity);
        sizeRepository.save(size);
    }

    @Override
    public Product findProductBySizeId(String sizeId) {
        Size size = sizeRepository.findById(sizeId)
                .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));
        return size.getProduct();
    }

    @Override
    public Product createProduct(ProductCreateRequest request, MultipartFile[] files) {
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
                            .weight(sizeRequest.getWeight() != null ? sizeRequest.getWeight() : 500) // Default 500g if not provided
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
            if (managedSizes != null) {
                managedSizes.clear();
            }

            if (!request.getSizes().isEmpty()) {
                List<Size> newSizes = request.getSizes().stream()
                        .map(sizeRequest -> Size.builder()
                                .name(sizeRequest.getName())
                                .description(sizeRequest.getDescription())
                                .stock(sizeRequest.getStock())
                                .priceModifier(sizeRequest.getPriceModifier())
                                .weight(sizeRequest.getWeight() != null ? sizeRequest.getWeight() : 500) // Default 500g if not provided
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

        return productRepository.save(toUpdate);
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
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);
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
}