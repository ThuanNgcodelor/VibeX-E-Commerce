package com.example.stockservice.service;

import com.example.stockservice.dto.ReviewDto;
import com.example.stockservice.model.Review;
import com.example.stockservice.repository.ReviewRepository;
import com.example.stockservice.request.ReviewRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private final ReviewRepository reviewRepository;

    public ReviewDto createReview(ReviewRequest request) {
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
        return mapToDto(saved);
    }

    public List<ReviewDto> getReviewsByProductId(String productId) {
        return reviewRepository.findByProductIdOrderByCreatedAtDesc(productId).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    public List<ReviewDto> getReviewsByShopId(String shopId) {
        System.out.println("DEBUG: Fetching reviews for shopId: " + shopId);
        List<Review> reviews = reviewRepository.findByShopId(shopId);
        System.out.println("DEBUG: Found " + reviews.size() + " reviews for shopId: " + shopId);
        return reviews.stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
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
        return ReviewDto.builder()
                .id(review.getId())
                .userId(review.getUserId())
                .username(review.getUsername())
                .userAvatar(review.getUserAvatar())
                .productId(review.getProductId())
                .rating(review.getRating())
                .comment(review.getComment())
                .imageIds(review.getImageIds())
                .reply(review.getReply())
                .repliedAt(review.getRepliedAt())
                .createdAt(review.getCreatedAt())
                .build();
    }
}