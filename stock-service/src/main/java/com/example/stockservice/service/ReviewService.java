package com.example.stockservice.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.stockservice.client.ShopCoinClient;
import com.example.stockservice.dto.ReviewDto;
import com.example.stockservice.model.Review;
import com.example.stockservice.repository.ReviewRepository;
import com.example.stockservice.request.ReviewRequest;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private final ReviewRepository reviewRepository;
    private final ShopCoinClient shopCoinClient;
    private final com.example.stockservice.repository.ProductRepository productRepository;
    private final com.example.stockservice.client.UserServiceClient userServiceClient;
    private final com.example.stockservice.client.ShopOwnerClient shopOwnerClient;

    public ReviewDto createReview(String token, ReviewRequest request) {
        Review review = Review.builder()
                .userId(request.getUserId())
                .username(request.getUsername())
                .userAvatar(request.getUserAvatar())
                .productId(request.getProductId())
                .rating(request.getRating())
                .comment(request.getComment() == null ? "" : request.getComment())
                .imageIds(request.getImageIds() == null ? List.of() : request.getImageIds())
                .build();

        Review saved = reviewRepository.save(review);

        try {
            shopCoinClient.completeReviewMission(token, request.getUserId());
        } catch (Exception e) {
            System.err.println("Failed to award ShopCoins for review: " + e.getMessage());
        }

        return mapToDto(saved);
    }

    public List<ReviewDto> getReviewsByProductId(String productId) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public Page<ReviewDto> getReviewsByShopId(String shopId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Review> reviewPage = reviewRepository.findByShopId(shopId, pageable);
        return reviewPage.map(this::mapToDto);
    }

    public ReviewDto replyToReview(String reviewId, String reply) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new RuntimeException("Review not found"));

        review.setReply(reply);
        review.setRepliedAt(LocalDateTime.now());

        Review saved = reviewRepository.save(review);
        return mapToDto(saved);
    }

    public long countReviewsByShopId(String shopId) {
        return reviewRepository.countReviewsByShopId(shopId);
    }

    private ReviewDto mapToDto(Review review) {
        String pName = "";
        String pImage = "";
        String freshAvatar = review.getUserAvatar();

        try {
            com.example.stockservice.model.Product p = productRepository.findById(review.getProductId()).orElse(null);
            if (p != null) {
                pName = p.getName();
                if (p.getImageId() != null && !p.getImageId().isEmpty()) {
                    pImage = p.getImageId();
                }
            }
        } catch (Exception e) {
            // ignore
        }

        try {
            org.springframework.http.ResponseEntity<com.example.stockservice.dto.UserDto> userRes = userServiceClient
                    .getUserById(review.getUserId());
            if (userRes != null && userRes.getBody() != null && userRes.getBody().getImageUrl() != null) {
                freshAvatar = userRes.getBody().getImageUrl();
            } else {
                org.springframework.http.ResponseEntity<com.example.stockservice.dto.ShopOwnerDto> shopRes = shopOwnerClient
                        .getShopOwnerByUserId(review.getUserId());
                if (shopRes != null && shopRes.getBody() != null && shopRes.getBody().getImageUrl() != null) {
                    freshAvatar = shopRes.getBody().getImageUrl();
                }
            }
        } catch (Exception e) {
            // System.out.println("DEBUG: Failed to fetch fresh avatar for user " +
            // review.getUserId() + ": " + e.getMessage());
        }

        return ReviewDto.builder()
                .id(review.getId())
                .userId(review.getUserId())
                .username(review.getUsername())
                .userAvatar(freshAvatar)
                .productId(review.getProductId())
                .productName(pName)
                .productImage(pImage)
                .rating(review.getRating())
                .comment(review.getComment())
                .imageIds(review.getImageIds())
                .reply(review.getReply())
                .repliedAt(review.getRepliedAt())
                .createdAt(review.getCreatedAt())
                .build();
    }

    @Transactional(readOnly = true)
    public boolean hasUserReviewedToday(String userId) {
        // Implement logic to check if user has a review with createdDate == Today
        // Assuming BaseEntity has createdDate or using a custom query
        // Let's use custom query in Repository or filter here if list is small (not
        // ideal).
        // Better: countByUserIdAndCreatedDateBetween
        java.time.LocalDateTime startOfDay = java.time.LocalDate.now().atStartOfDay();
        java.time.LocalDateTime endOfDay = java.time.LocalDate.now().atTime(java.time.LocalTime.MAX);
        return reviewRepository.existsByUserIdAndCreatedAtBetween(userId, startOfDay, endOfDay);
    }
}