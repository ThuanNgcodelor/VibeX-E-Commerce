package com.example.notificationservice.controller;

import com.example.notificationservice.jwt.JwtUtil;
import com.example.notificationservice.model.Notification;
import com.example.notificationservice.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.example.notificationservice.request.SendNotificationRequest;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/notifications")
public class NotificationController {
    private final NotificationService notificationService;
    private final JwtUtil jwtUtil;

    @PostMapping("/send")
    public ResponseEntity<Void> sendNotification(@RequestBody SendNotificationRequest request) {
        notificationService.save(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/getAllByUserId")
    public ResponseEntity<List<Notification>> getAllByUserId(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(notificationService.getAllNotifications(userId));
    }

    @GetMapping("/getAllByShopId")
    public ResponseEntity<List<Notification>> getAllByShopId(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        String shopId = userId;
        return ResponseEntity.ok(notificationService.getAllNotificationsByShopId(shopId));
    }

    @PutMapping("/markAsRead/{notificationId}")
    public ResponseEntity<Void> markAsRead(@PathVariable String notificationId) {
        notificationService.markAsRead(notificationId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/delete/{notificationId}")
    public ResponseEntity<Void> deleteNotification(@PathVariable String notificationId) {
        notificationService.deleteNotification(notificationId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/deleteAllByUserId")
    public ResponseEntity<Void> deleteAllByUserId(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        notificationService.deleteAllNotifications(userId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/deleteAllByShopId")
    public ResponseEntity<Void> deleteAllByShopId(HttpServletRequest request) {
        String shopId = jwtUtil.ExtractUserId(request);
        notificationService.deleteAllNotificationsByShopId(shopId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/markAllAsReadByUserId")
    public ResponseEntity<Void> markAllAsReadByUserId(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/markAllAsReadByShopId")
    public ResponseEntity<Void> markAllAsReadByShopId(HttpServletRequest request) {
        String shopId = jwtUtil.ExtractUserId(request);
        notificationService.markAllAsReadByShopId(shopId);
        return ResponseEntity.ok().build();
    }

    // =============== NEW BROADCAST ENDPOINTS ===============

    /**
     * Admin broadcast notification to all users
     * POST /v1/notifications/admin/broadcast
     */
    @PostMapping("/admin/broadcast")
    public ResponseEntity<com.example.notificationservice.dto.BroadcastResult> adminBroadcast(
            @RequestBody com.example.notificationservice.request.AdminBroadcastRequest request) {
        return ResponseEntity.ok(notificationService.broadcastToAllUsers(request));
    }

    /**
     * Shop owner notify all followers
     * POST /v1/notifications/shop/notify-followers
     */
    @PostMapping("/shop/notify-followers")
    public ResponseEntity<com.example.notificationservice.dto.BroadcastResult> notifyFollowers(
            HttpServletRequest request,
            @RequestBody com.example.notificationservice.request.ShopNotifyRequest body) {
        String shopId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(notificationService.notifyFollowers(shopId, body));
    }
}
