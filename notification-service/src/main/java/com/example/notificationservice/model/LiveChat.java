package com.example.notificationservice.model;

import com.example.notificationservice.enums.LiveChatType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "live_chats", indexes = {
    @Index(name = "idx_live_room_time", columnList = "live_room_id, created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveChat {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;
    
    @Column(name = "live_room_id", nullable = false)
    private String liveRoomId;
    
    @Column(name = "user_id", nullable = false)
    private String userId;
    
    @Column(length = 255)
    private String username;
    
    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;
    
    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private LiveChatType type = LiveChatType.CHAT;
    
    @Column(name = "is_pinned")
    @Builder.Default
    private Boolean isPinned = false;
    
    // For ORDER type - reference to product
    @Column(name = "product_id")
    private String productId;
    
    @Column(name = "product_name")
    private String productName;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
