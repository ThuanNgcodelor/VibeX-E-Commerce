package com.example.userservice.client;

import com.example.userservice.dto.CartDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "stock-service", path = "/v1/stock")
public interface StockServiceClient {

    @GetMapping("/cart/user")
    ResponseEntity<CartDto> getCart(@RequestHeader("Authorization") String token);

    @GetMapping("/reviews/check-today/{userId}")
    ResponseEntity<Boolean> hasUserReviewedToday(
            @org.springframework.web.bind.annotation.PathVariable("userId") String userId);
}
