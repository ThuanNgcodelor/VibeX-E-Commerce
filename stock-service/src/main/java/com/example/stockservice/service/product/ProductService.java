package com.example.stockservice.service.product;

import com.example.stockservice.model.Product;
import com.example.stockservice.request.product.ProductCreateRequest;
import com.example.stockservice.request.product.ProductUpdateRequest;
import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ProductService {
    Product createProduct(ProductCreateRequest request, MultipartFile[] files);
    Product updateProduct(ProductUpdateRequest request, MultipartFile[] files);
    Product getProductById(String id);
    Product findProductById(String id);
    void deleteProduct(String id);
    Page<Product> getAllProducts(Integer pageNo, Integer pageSize);
    Page<Product> searchProductByKeyword(String keyword, Integer pageNo, Integer pageSize);
    List<Product> getAllProducts();
    void decreaseStockBySize(String sizeId, int quantity);
    void increaseStockBySize(String sizeId, int quantity);
    Product findProductBySizeId(String sizeId);
    Page<Product> getProductsByUserId(String userId, Integer pageNo);
    List<Product> getAllProductsByUserId(String userId);
    Page<Product> getProductsByUserIdWithPaging(String userId, Integer pageNo, Integer pageSize);
    Page<Product> searchProductsByUserId(String userId, String keyword, Integer pageNo, Integer pageSize);

    long countProductsByUserId(String userId);

    long countProductsByUserIdAndStatus(String userId, com.example.stockservice.enums.ProductStatus status);
}
