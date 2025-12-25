package com.example.stockservice.controller;

import com.example.stockservice.dto.ReviewDto;
import com.example.stockservice.request.ReviewRequest;
import com.example.stockservice.service.ReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/stock/reviews")
@RequiredArgsConstructor
public class ReviewController {
    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReviewDto> createReview(
            @RequestHeader("Authorization") String token,
            @RequestBody ReviewRequest request) {
        return ResponseEntity.ok(reviewService.createReview(token, request));
    }
    @GetMapping("/product/{productId}")
    public ResponseEntity<List<ReviewDto>> getReviewsByProductId(@PathVariable String productId) {
        return ResponseEntity.ok(reviewService.getReviewsByProductId(productId));
    }

    @GetMapping("/count/shop/{shopId}")
    public ResponseEntity<Long> countReviewsByShopId(@PathVariable String shopId) {
        System.out.println("DEBUG: Counting reviews for shopId: " + shopId);
        Long count = reviewService.countReviewsByShopId(shopId);
        System.out.println("DEBUG: Review count: " + count);
        return ResponseEntity.ok(count);
    }

    @GetMapping("/shop/{shopId}")
    public ResponseEntity<List<ReviewDto>> getReviewsByShopId(@PathVariable String shopId) {
        return ResponseEntity.ok(reviewService.getReviewsByShopId(shopId));
    }

    @PostMapping("/{reviewId}/reply")
    public ResponseEntity<ReviewDto> replyReview(@PathVariable String reviewId, @RequestBody String reply) {
        return ResponseEntity.ok(reviewService.replyToReview(reviewId, reply));
    }

    @GetMapping("/check-today/{userId}")
    public ResponseEntity<Boolean> hasUserReviewedToday(@PathVariable String userId) {
        return ResponseEntity.ok(reviewService.hasUserReviewedToday(userId));
    }
}