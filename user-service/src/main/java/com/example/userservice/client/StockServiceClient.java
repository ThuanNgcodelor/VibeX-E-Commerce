package com.example.userservice.client;

import com.example.userservice.dto.CartDto;
import com.example.userservice.dto.ReviewDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;

@FeignClient(name = "stock-service", path = "/v1/stock")
public interface StockServiceClient {

    @GetMapping("/reviews/check-today/{userId}")
    ResponseEntity<Boolean> hasUserReviewedToday(@PathVariable("userId") String userId);

    @GetMapping("/reviews/count/shop/{shopId}")
    ResponseEntity<Long> getShopReviewCount(@PathVariable("shopId") String shopId);

    @GetMapping("/product/internal/count/shop/{shopId}")
    ResponseEntity<Long> getShopProductCount(@PathVariable("shopId") String shopId);

    @GetMapping("/cart/user")
    ResponseEntity<CartDto> getCart(@RequestHeader("Authorization") String token);

    @GetMapping(value = "/product/{productId}", headers = "X-Internal-Call=true")
    ResponseEntity<List<ReviewDto>> getReviewsByProductId(@PathVariable String productId);

    @GetMapping("/product/internal/category-stats/shop/{shopId}")
    ResponseEntity<List<java.util.Map<String, Object>>> getShopCategoryStats(@PathVariable("shopId") String shopId);
}
