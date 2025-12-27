package com.example.stockservice.config;

import com.example.stockservice.service.ai.ProductTools;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Description;

import java.util.function.Function;

/**
 * Configuration để đăng ký các Function Beans cho Spring AI
 */
@Configuration
public class AiFunctionConfig {

    private final ProductTools productTools;

    public AiFunctionConfig(ProductTools productTools) {
        this.productTools = productTools;
    }

    @Bean
    @Description("Search products by name or keyword. Use this when user wants to find products.")
    public Function<ProductTools.SearchRequest, ProductTools.SearchResponse> searchProducts() {
        return productTools.searchProducts();
    }

    @Bean
    @Description("Get price of a specific product by name. Use this when user asks about product price.")
    public Function<ProductTools.PriceRequest, ProductTools.PriceResponse> getProductPrice() {
        return productTools.getProductPrice();
    }

    @Bean
    @Description("Get all products currently on sale or discount. Use this when user asks about discounted products or promotions.")
    public Function<ProductTools.DiscountRequest, ProductTools.DiscountResponse> getDiscountedProducts() {
        return productTools.getDiscountedProducts();
    }

    @Bean
    @Description("Get detailed information of a product by its ID.")
    public Function<ProductTools.ProductDetailRequest, ProductTools.ProductDetailResponse> getProductDetails() {
        return productTools.getProductDetails();
    }
}
