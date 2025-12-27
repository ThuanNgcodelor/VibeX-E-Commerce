package com.example.stockservice.service.ai;

import com.example.stockservice.model.Product;
import com.example.stockservice.service.product.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Description;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Product Tools for AI Function Calling
 * Ollama sẽ gọi các functions này khi cần query dữ liệu sản phẩm
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProductTools {

    private final ProductService productService;
    private final NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(new Locale("vi", "VN"));

    /**
     * Record để trả về thông tin sản phẩm cho AI
     */
    public record ProductInfo(
            String id,
            String name,
            String price,
            String originalPrice,
            String discountPercent,
            String description
    ) {}

    /**
     * Request/Response records cho Function Calling
     */
    public record SearchRequest(String keyword) {}
    public record SearchResponse(List<ProductInfo> products, String message) {}

    public record PriceRequest(String productName) {}
    public record PriceResponse(String productName, String price, String originalPrice, String discountPercent, boolean found) {}

    public record DiscountRequest() {}
    public record DiscountResponse(List<ProductInfo> products, String message) {}

    public record ProductDetailRequest(String productId) {}
    public record ProductDetailResponse(ProductInfo product, boolean found) {}

    /**
     * Tìm kiếm sản phẩm theo keyword
     */
    @Description("Search products by name or keyword. Use this when user wants to find products.")
    public Function<SearchRequest, SearchResponse> searchProducts() {
        return request -> {
            log.info("Tool called: searchProducts({})", request.keyword());
            try {
                Page<Product> results = productService.searchProductByKeyword(request.keyword(), 1, 5);
                List<ProductInfo> products = results.getContent().stream()
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                String message = products.isEmpty()
                        ? "Không tìm thấy sản phẩm nào với từ khóa '" + request.keyword() + "'"
                        : "Tìm thấy " + products.size() + " sản phẩm";

                return new SearchResponse(products, message);
            } catch (Exception e) {
                log.error("Error searching products: ", e);
                return new SearchResponse(List.of(), "Lỗi khi tìm kiếm sản phẩm");
            }
        };
    }

    /**
     * Lấy giá sản phẩm theo tên
     */
    @Description("Get price of a specific product by name. Use this when user asks about product price.")
    public Function<PriceRequest, PriceResponse> getProductPrice() {
        return request -> {
            log.info(" Tool called: getProductPrice({})", request.productName());
            try {
                Page<Product> results = productService.searchProductByKeyword(request.productName(), 1, 1);
                if (results.isEmpty()) {
                    return new PriceResponse(request.productName(), null, null, null, false);
                }

                Product product = results.getContent().get(0);
                return new PriceResponse(
                        product.getName(),
                        formatPrice(product.getPrice()),
                        formatPrice(product.getOriginalPrice()),
                        product.getDiscountPercent() > 0 ? product.getDiscountPercent() + "%" : null,
                        true
                );
            } catch (Exception e) {
                log.error("Error getting product price: ", e);
                return new PriceResponse(request.productName(), null, null, null, false);
            }
        };
    }

    /**
     * Lấy danh sách sản phẩm đang giảm giá
     */
    @Description("Get all products currently on sale or discount. Use this when user asks about discounted products, sale, or promotions.")
    public Function<DiscountRequest, DiscountResponse> getDiscountedProducts() {
        return request -> {
            log.info(" Tool called: getDiscountedProducts()");
            try {
                Page<Product> allProducts = productService.getAllProducts(1, 50);
                List<ProductInfo> discounted = allProducts.getContent().stream()
                        .filter(p -> p.getDiscountPercent() > 0)
                        .limit(5)
                        .map(this::toProductInfo)
                        .collect(Collectors.toList());

                String message = discounted.isEmpty()
                        ? "Hiện tại không có sản phẩm nào đang giảm giá"
                        : "Có " + discounted.size() + " sản phẩm đang giảm giá";

                return new DiscountResponse(discounted, message);
            } catch (Exception e) {
                log.error("Error getting discounted products: ", e);
                return new DiscountResponse(List.of(), "Lỗi khi tìm sản phẩm giảm giá");
            }
        };
    }

    /**
     * Lấy chi tiết sản phẩm theo ID
     */
    @Description("Get detailed information of a product by its ID.")
    public Function<ProductDetailRequest, ProductDetailResponse> getProductDetails() {
        return request -> {
            log.info("Tool called: getProductDetails({})", request.productId());
            try {
                Product product = productService.findProductById(request.productId());
                if (product == null) {
                    return new ProductDetailResponse(null, false);
                }
                return new ProductDetailResponse(toProductInfo(product), true);
            } catch (Exception e) {
                log.error("Error getting product details: ", e);
                return new ProductDetailResponse(null, false);
            }
        };
    }

    private ProductInfo toProductInfo(Product product) {
        return new ProductInfo(
                product.getId(),
                product.getName(),
                formatPrice(product.getPrice()),
                formatPrice(product.getOriginalPrice()),
                product.getDiscountPercent() > 0 ? product.getDiscountPercent() + "%" : null,
                product.getDescription() != null 
                        ? (product.getDescription().length() > 100 
                                ? product.getDescription().substring(0, 100) + "..." 
                                : product.getDescription())
                        : null
        );
    }

    private String formatPrice(Double price) {
        if (price == null || price == 0) return null;
        return String.format("%,.0f₫", price);
    }
}
