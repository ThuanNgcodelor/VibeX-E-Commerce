package com.example.notificationservice.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
@Entity(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;

    private String userId;
    private String shopId;
    private String orderId;
    private String message;

    @Column(name = "is_read")
    @JsonProperty("isRead")
    private boolean read;

    @Column(name = "is_shop_owner_notification")
    @JsonProperty("isShopOwnerNotification")
    @Builder.Default
    private boolean shopOwnerNotification = false; // true = notification for shop owner, false = notification for user

    @CreationTimestamp
    private LocalDateTime creationTimestamp;
}