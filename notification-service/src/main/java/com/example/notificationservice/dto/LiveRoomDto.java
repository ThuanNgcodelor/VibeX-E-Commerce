package com.example.notificationservice.dto;

import com.example.notificationservice.enums.LiveStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

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
    private String streamKey;
    private String streamUrl;          // HLS URL for playback
    private String thumbnailUrl;
    private LiveStatus status;
    private Integer viewerCount;
    private Integer peakViewers;
    private Integer totalOrders;
    private Double totalRevenue;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private LocalDateTime createdAt;
    private List<LiveProductDto> products;
}
