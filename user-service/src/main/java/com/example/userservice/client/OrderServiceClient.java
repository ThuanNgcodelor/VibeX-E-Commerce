package com.example.userservice.client;

import com.example.userservice.dto.DeductSubscriptionRequestDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "order-service", path = "/v1/order/ledger")
public interface OrderServiceClient {

    @PostMapping("/internal/deduct-fee")
    ResponseEntity<?> deductSubscriptionFee(@RequestBody DeductSubscriptionRequestDTO request);
}
