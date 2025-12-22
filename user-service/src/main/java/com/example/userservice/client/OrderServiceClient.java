package com.example.userservice.client;

import com.example.userservice.config.FeignConfig;
import com.example.userservice.dto.DeductSubscriptionRequestDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "order-service", path = "/v1/order", configuration = FeignConfig.class)
public interface OrderServiceClient {

    @PostMapping("/ledger/internal/deduct-fee")
    ResponseEntity<Void> deductSubscriptionFee(@RequestBody DeductSubscriptionRequestDTO request);
}