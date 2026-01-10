package com.example.orderservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "stock-service", contextId = "flashSaleClient")
public interface FlashSaleClient {

        @PostMapping(value = "/v1/stock/flash-sale/reserve",headers = "X-Internal-Call=true")
        String reserveStock(@RequestParam("orderId") String orderId,
                        @RequestParam("productId") String productId,
                        @RequestParam("sizeId") String sizeId,
                        @RequestParam("quantity") int quantity,
                        @RequestParam("userId") String userId);

        @PostMapping(value = "/v1/stock/flash-sale/confirm",headers = "X-Internal-Call=true")
        String confirmReservation(@RequestParam("orderId") String orderId,
                        @RequestParam("productId") String productId,
                        @RequestParam("sizeId") String sizeId);

        @PostMapping(value = "/v1/stock/flash-sale/cancel",headers = "X-Internal-Call=true")
        String cancelReservation(@RequestParam("orderId") String orderId,
                        @RequestParam("productId") String productId,
                        @RequestParam("sizeId") String sizeId,
                        @RequestParam("userId") String userId);
}
