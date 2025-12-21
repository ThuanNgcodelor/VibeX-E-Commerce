package com.example.notificationservice.client;

import com.example.notificationservice.config.FeignConfig;
import com.example.notificationservice.dto.ProductDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "stock-service", path = "/v1/stock", configuration = FeignConfig.class)
public interface StockServiceClient {

    @GetMapping(value = "/product/getProductById/{id}",headers = "X-Internal-Call=true")
    ResponseEntity<ProductDto> getProductById(@PathVariable String id);
}
