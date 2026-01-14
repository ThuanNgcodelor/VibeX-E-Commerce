package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for Live Room information from notification-service
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveRoomDto {
    private String id;
    private String shopOwnerId;
    private String shopName;
    private String shopAvatarUrl;
    private String title;
    private String description;
    private String streamUrl;
    private String thumbnailUrl;
    private String status; // PENDING, LIVE, ENDED
    private Integer viewerCount;
    private Integer peakViewers;
    private Integer totalOrders;
    private Double totalRevenue;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private LocalDateTime createdAt;
    private List<LiveProductDto> products;
}
