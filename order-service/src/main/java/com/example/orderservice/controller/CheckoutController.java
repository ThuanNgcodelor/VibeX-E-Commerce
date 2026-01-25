package com.example.orderservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.orderservice.dto.CheckoutPreviewRequest;
import com.example.orderservice.dto.CheckoutPreviewResponse;
import com.example.orderservice.service.CheckoutService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/order/checkout")
@RequiredArgsConstructor
public class CheckoutController {

    private final CheckoutService checkoutService;
    private final com.example.orderservice.jwt.JwtUtil jwtUtil;

    @PostMapping("/preview")
    public ResponseEntity<CheckoutPreviewResponse> previewCheckout(@RequestBody CheckoutPreviewRequest request, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String userId = jwtUtil.ExtractUserId(httpRequest);
        request.setUserId(userId);
        return ResponseEntity.ok(checkoutService.previewCheckout(request));
    }
}
