package com.example.notificationservice.model;

import com.example.notificationservice.enums.LiveStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "live_rooms", indexes = {
    @Index(name = "idx_shop_owner", columnList = "shop_owner_id"),
    @Index(name = "idx_status", columnList = "status")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveRoom {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;
    
    @Column(name = "shop_owner_id", nullable = false)
    private String shopOwnerId;
    
    @Column(nullable = false, length = 500)
    private String title;
    
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "stream_key", unique = true, nullable = false, length = 100)
    private String streamKey;
    
    @Column(name = "thumbnail_url", length = 500)
    private String thumbnailUrl;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private LiveStatus status = LiveStatus.PENDING;
    
    @Column(name = "viewer_count")
    @Builder.Default
    private Integer viewerCount = 0;
    
    @Column(name = "peak_viewers")
    @Builder.Default
    private Integer peakViewers = 0;
    
    @Column(name = "total_orders")
    @Builder.Default
    private Integer totalOrders = 0;
    
    @Column(name = "total_revenue")
    @Builder.Default
    private Double totalRevenue = 0.0;
    
    @Column(name = "started_at")
    private LocalDateTime startedAt;
    
    @Column(name = "ended_at")
    private LocalDateTime endedAt;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @OneToMany(mappedBy = "liveRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LiveProduct> products = new ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        if (streamKey == null) {
            streamKey = UUID.randomUUID().toString().replace("-", "");
        }
    }
}
