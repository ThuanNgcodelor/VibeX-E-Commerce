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
import java.util.Map;

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

        @GetMapping(value = "/product/ids/by-category", headers = "X-Internal-Call=true")
        ResponseEntity<List<String>> getProductIdsByCategoryName(@RequestParam("name") String name);

        // Batch API methods for performance optimization
        @PostMapping(value = "/product/batch-get", headers = "X-Internal-Call=true")
        ResponseEntity<java.util.Map<String, ProductDto>> batchGetProducts(
                        @RequestBody BatchGetProductsRequest request);

        @PostMapping(value = "/product/batch-decrease", headers = "X-Internal-Call=true")
        ResponseEntity<java.util.Map<String, Boolean>> batchDecreaseStock(
                        @RequestBody BatchDecreaseStockRequest request);

        /**
         * Reserve stock for an order
         * 
         * @param request { orderId, productId, sizeId, quantity }
         * @return { success, status, reservedQuantity } or { success, status, message }
         */
        @PostMapping(value = "/reservation/reserve", headers = "X-Internal-Call=true")
        ResponseEntity<Map<String, Object>> reserveStock(@RequestBody ReserveRequest request);

        /**
         * Confirm reservation after order/payment success
         * 
         * @param request { orderId, productId, sizeId }
         * @return { success, message }
         */
        @PostMapping(value = "/reservation/confirm", headers = "X-Internal-Call=true")
        ResponseEntity<Map<String, Object>> confirmReservation(@RequestBody ReserveRequest request);

        /**
         * Cancel reservation and rollback stock
         * 
         * @param request { orderId, productId, sizeId }
         * @return { success, rolledBackQuantity }
         */
        @PostMapping(value = "/reservation/cancel", headers = "X-Internal-Call=true")
        ResponseEntity<Map<String, Object>> cancelReservation(@RequestBody ReserveRequest request);

        /**
         * Restore stock for cancelled order (Redis + DB)
         * 
         * @param request { productId, sizeId, quantity }
         * @return { success, message }
         */
        @PostMapping(value = "/product/restoreStock", headers = "X-Internal-Call=true")
        ResponseEntity<Map<String, Object>> restoreStock(@RequestBody RestoreStockRequest request);

        /**
         * Request DTO for reservation operations
         */
        record ReserveRequest(
                        String orderId,
                        String productId,
                        String sizeId,
                        int quantity) {
        }

        /**
         * Request DTO for stock restoration
         */
        record RestoreStockRequest(
                        String productId,
                        String sizeId,
                        int quantity) {
        }
}
