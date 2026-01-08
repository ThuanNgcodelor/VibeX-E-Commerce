package com.example.orderservice.client;

import com.example.orderservice.config.FeignConfig;
import com.example.orderservice.dto.*;
import com.example.orderservice.request.DecreaseStockRequest;
import com.example.orderservice.request.RemoveCartItemRequest;
import com.example.orderservice.request.RemoveCartItemByUserIdRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@FeignClient(name = "stock-service", path = "/v1/stock", configuration = FeignConfig.class)
public interface StockServiceClient {

    @PostMapping(value = "/cart/removeItems", headers = "X-Internal-Call=true")
    ResponseEntity<Void> removeCartItems(@RequestBody RemoveCartItemRequest request);

    @PostMapping(value = "/product/decreaseStock", headers = "X-Internal-Call=true")
    ProductDto decreaseStock(@RequestBody DecreaseStockRequest request);

    @PostMapping(value = "/product/increaseStock", headers = "X-Internal-Call=true")
    ProductDto increaseStock(@RequestBody com.example.orderservice.request.IncreaseStockRequest request);

    @GetMapping("/cart/user")
    ResponseEntity<CartDto> getCart(@RequestHeader("Authorization") String token);

    @GetMapping("/cart/getCartByUserId")
    ResponseEntity<CartDto> getCartByUserId(HttpServletRequest request);

    @GetMapping(value = "/cart/getCartByUserId/{userId}", headers = "X-Internal-Call=true")
    ResponseEntity<CartDto> getCartByUserIdInternal(@PathVariable String userId);

    @GetMapping(value = "/product/getProductById/{id}", headers = "X-Internal-Call=true")
    ResponseEntity<ProductDto> getProductById(@PathVariable String id);

    @GetMapping(value = "/size/getSizeById/{sizeId}", headers = "X-Internal-Call=true")
    ResponseEntity<SizeDto> getSizeById(@PathVariable String sizeId);

    @DeleteMapping(value = "/cart/clear/{cartId}", headers = "X-Internal-Call=true")
    ResponseEntity<Void> clearCartByCartId(@PathVariable String cartId);

    @PostMapping(value = "/cart/removeItemsByUserId", headers = "X-Internal-Call=true")
    ResponseEntity<Void> removeCartItemsByUserId(@RequestBody RemoveCartItemByUserIdRequest request);

    @GetMapping(value = "/product/shop-owner/{userId}/ids", headers = "X-Internal-Call=true")
    ResponseEntity<List<String>> getProductIdsByShopOwner(@PathVariable String userId);

    @GetMapping(value = "/analytics/shop/{shopId}/views", headers = "X-Internal-Call=true")
    ResponseEntity<Long> getShopTotalViews(@PathVariable String shopId);

    @GetMapping(value = "/analytics/system/views", headers = "X-Internal-Call=true")
    ResponseEntity<Long> getSystemTotalViews();

    @GetMapping(value = "/analytics/system/visits", headers = "X-Internal-Call=true")
    ResponseEntity<Long> getSystemSiteVisits();

    @GetMapping(value = "/analytics/system/cart-adds", headers = "X-Internal-Call=true")
    ResponseEntity<Long> getSystemAddToCart();

    @GetMapping(value = "/flash-sale/available-stock/{productId}", headers = "X-Internal-Call=true")
    int getFlashSaleStock(@PathVariable String productId);

    // Batch API methods for performance optimization
    @PostMapping(value = "/product/batch-get", headers = "X-Internal-Call=true")
    ResponseEntity<java.util.Map<String, ProductDto>> batchGetProducts(
        @RequestBody BatchGetProductsRequest request);

    @PostMapping(value = "/product/batch-decrease", headers = "X-Internal-Call=true")
    ResponseEntity<java.util.Map<String, Boolean>> batchDecreaseStock(
        @RequestBody BatchDecreaseStockRequest request);
}
