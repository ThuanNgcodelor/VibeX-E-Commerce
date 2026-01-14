package com.example.notificationservice.service;

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
}
