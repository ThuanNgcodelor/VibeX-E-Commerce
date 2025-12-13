package com.example.stockservice.service;

import com.example.stockservice.dto.ReviewDto;
import com.example.stockservice.model.Review;
import com.example.stockservice.repository.ReviewRepository;
import com.example.stockservice.request.ReviewRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
                .createdAt(review.getCreatedAt())
                .build();
    }
}