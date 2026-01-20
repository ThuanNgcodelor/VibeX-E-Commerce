package com.example.notificationservice.service;

import com.example.notificationservice.client.UserServiceClient;
import com.example.notificationservice.model.Notification;
import com.example.notificationservice.repository.NotificationRepository;
import com.example.notificationservice.request.SendNotificationRequest;
import com.example.notificationservice.dto.NotificationUpdateEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final UserServiceClient userServiceClient;

    public Notification save(SendNotificationRequest request) {
        String userId = request.getUserId();
        String shopId = request.getShopId();

        if (userId != null && shopId != null && !userId.equals(shopId)) {
            shopId = userId;
        } else if (userId != null && shopId == null) {
            shopId = userId;
        } else if (userId == null && shopId != null) {
            userId = shopId;
        }

        boolean isShopOwnerNotification = request.getIsShopOwnerNotification() != null
                ? request.getIsShopOwnerNotification()
                : false;

        var notification = Notification.builder()
                .userId(userId)
                .shopId(shopId)
                .orderId(request.getOrderId())
                .message(request.getMessage())
                .read(false)
                .shopOwnerNotification(isShopOwnerNotification)
                .build();

        Notification savedNotification = notificationRepository.save(notification);
        webSocketNotificationService.pushNotification(savedNotification);
        return savedNotification;
    }

    public List<Notification> getAllNotifications(String id) {
        return notificationRepository.findAllByUserIdAndShopOwnerNotificationOrderByCreationTimestampDesc(id, false);
    }

    public List<Notification> getAllNotificationsByShopId(String shopId) {
        return notificationRepository.findAllByShopIdAndShopOwnerNotificationOrderByCreationTimestampDesc(shopId, true);
    }

    @Transactional
    public void markAsRead(String notificationId) {
        var notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setRead(true);
        notificationRepository.save(notification);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.MARKED_AS_READ)
                .notificationId(notificationId)
                .userId(notification.getUserId())
                .isShopOwner(notification.isShopOwnerNotification())
                .build();

        webSocketNotificationService.broadcastUpdate(
                notification.getUserId(),
                notification.getShopId(),
                notification.isShopOwnerNotification(),
                updateEvent);
    }

    @Transactional
    public void deleteNotification(String notificationId) {
        var notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        String userId = notification.getUserId();
        String shopId = notification.getShopId();
        boolean isShopOwner = notification.isShopOwnerNotification();

        notificationRepository.deleteById(notificationId);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.DELETED)
                .notificationId(notificationId)
                .userId(userId)
                .isShopOwner(isShopOwner)
                .build();

        webSocketNotificationService.broadcastUpdate(userId, shopId, isShopOwner, updateEvent);
    }

    @Transactional
    public void deleteAllNotifications(String userId) {
        var notifications = notificationRepository
                .findAllByUserIdAndShopOwnerNotificationOrderByCreationTimestampDesc(userId, false);
        notificationRepository.deleteAll(notifications);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.DELETED_ALL)
                .userId(userId)
                .isShopOwner(false)
                .build();

        webSocketNotificationService.broadcastUpdate(userId, userId, false, updateEvent);
    }

    @Transactional
    public void markAllAsRead(String userId) {
        var notifications = notificationRepository
                .findAllByUserIdAndShopOwnerNotificationOrderByCreationTimestampDesc(userId, false);
        for (var notification : notifications) {
            notification.setRead(true);
        }
        notificationRepository.saveAll(notifications);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.MARKED_ALL_AS_READ)
                .userId(userId)
                .isShopOwner(false)
                .build();

        webSocketNotificationService.broadcastUpdate(userId, userId, false, updateEvent);
    }

    @Transactional
    public void markAllAsReadByShopId(String shopId) {
        var notifications = notificationRepository
                .findAllByShopIdAndShopOwnerNotificationOrderByCreationTimestampDesc(shopId, true);
        for (var notification : notifications) {
            notification.setRead(true);
        }
        notificationRepository.saveAll(notifications);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.MARKED_ALL_AS_READ)
                .userId(shopId)
                .isShopOwner(true)
                .build();

        webSocketNotificationService.broadcastUpdate(shopId, shopId, true, updateEvent);
    }

    @Transactional
    public void deleteAllNotificationsByShopId(String shopId) {
        var notifications = notificationRepository
                .findAllByShopIdAndShopOwnerNotificationOrderByCreationTimestampDesc(shopId, true);
        notificationRepository.deleteAll(notifications);

        // Broadcast update event via WebSocket
        NotificationUpdateEvent updateEvent = NotificationUpdateEvent.builder()
                .updateType(NotificationUpdateEvent.UpdateType.DELETED_ALL)
                .userId(shopId)
                .isShopOwner(true)
                .build();

        webSocketNotificationService.broadcastUpdate(shopId, shopId, true, updateEvent);
    }

    // =============== NEW BROADCAST METHODS ===============

    /**
     * Broadcast notification to ALL active users (Admin only)
     */
    @Transactional
    public com.example.notificationservice.dto.BroadcastResult broadcastToAllUsers(
            com.example.notificationservice.request.AdminBroadcastRequest request) {
        
        List<String> userIds;
        try {
            // Get all active user IDs from user-service
            userIds = userServiceClient.getAllActiveUserIds().getBody();
        } catch (Exception e) {
            System.err.println("Failed to fetch active user IDs: " + e.getMessage());
            return com.example.notificationservice.dto.BroadcastResult.builder()
                    .success(false)
                    .sentCount(0)
                    .message("Failed to fetch user list: " + e.getMessage())
                    .build();
        }
        
        if (userIds == null || userIds.isEmpty()) {
            return com.example.notificationservice.dto.BroadcastResult.builder()
                    .success(false)
                    .sentCount(0)
                    .message("No active users found")
                    .build();
        }

        int sentCount = 0;
        for (String userId : userIds) {
            try {
                var notification = Notification.builder()
                        .userId(userId)
                        .shopId(userId)
                        .title(request.getTitle())
                        .message(request.getMessage())
                        .type(request.getType())
                        .actionUrl(request.getActionUrl())
                        .read(false)
                        .shopOwnerNotification(false)
                        .build();
                
                Notification saved = notificationRepository.save(notification);
                webSocketNotificationService.pushNotification(saved);
                sentCount++;
            } catch (Exception e) {
                System.err.println("Failed to send notification to user " + userId + ": " + e.getMessage());
            }
        }

        return com.example.notificationservice.dto.BroadcastResult.builder()
                .success(true)
                .sentCount(sentCount)
                .message("Broadcast sent to " + sentCount + " users")
                .build();
    }

    /**
     * Send notification to all followers of a shop (Shop Owner only)
     */
    @Transactional
    public com.example.notificationservice.dto.BroadcastResult notifyFollowers(
            String shopId,
            com.example.notificationservice.request.ShopNotifyRequest request) {
        
        List<String> followerIds;
        try {
            // Get all active user IDs from user-service
            followerIds = userServiceClient.getFollowerIds(shopId).getBody();
        } catch (Exception e) {
             System.err.println("Failed to fetch followers: " + e.getMessage());
             return com.example.notificationservice.dto.BroadcastResult.builder()
                     .success(false)
                     .sentCount(0)
                     .message("Failed to fetch followers: " + e.getMessage())
                     .build();
        }
        
        if (followerIds == null || followerIds.isEmpty()) {
            return com.example.notificationservice.dto.BroadcastResult.builder()
                    .success(false)
                    .sentCount(0)
                    .message("No followers found for this shop")
                    .build();
        }

        int sentCount = 0;
        for (String followerId : followerIds) {
            try {
                var notification = Notification.builder()
                        .userId(followerId)
                        .shopId(shopId)
                        .title(request.getTitle())
                        .message(request.getMessage())
                        .type(request.getType())
                        .actionUrl(request.getActionUrl())
                        .read(false)
                        .shopOwnerNotification(false) // Notification goes to USER, not shop owner
                        .build();
                
                Notification saved = notificationRepository.save(notification);
                webSocketNotificationService.pushNotification(saved);
                sentCount++;
            } catch (Exception e) {
                System.err.println("Failed to send notification to follower " + followerId + ": " + e.getMessage());
            }
        }

        return com.example.notificationservice.dto.BroadcastResult.builder()
                .success(true)
                .sentCount(sentCount)
                .message("Notification sent to " + sentCount + " followers")
                .build();
    }
}
