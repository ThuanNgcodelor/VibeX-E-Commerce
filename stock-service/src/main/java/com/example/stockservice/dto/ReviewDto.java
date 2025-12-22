package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ReviewDto {
    private String id;
    private String userId;
    private String username;
    private String userAvatar;
    private String productId;
    private int rating;
    private String comment;
    private List<String> imageIds;
    private String reply;
    private LocalDateTime repliedAt;
    private LocalDateTime createdAt;
}