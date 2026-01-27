package com.example.notificationservice.controller;

import com.example.notificationservice.dto.LiveChatDto;
import com.example.notificationservice.enums.LiveChatType;
import com.example.notificationservice.request.LiveChatRequest;
import com.example.notificationservice.service.LiveChatRedisService;
import com.example.notificationservice.service.LiveService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentSkipListSet;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * WebSocket Controller cho Livestream
 * 
 * Clients subscribe to:
 * /topic/live/{roomId}/chat - Nhận tin nhắn chat
 * /topic/live/{roomId}/product - Nhận cập nhật sản phẩm
 * /topic/live/{roomId}/order - Nhận thông báo đơn hàng
 * /topic/live/{roomId}/viewers - Nhận cập nhật số người xem
 * /topic/live/{roomId}/status - Nhận trạng thái live (start/end)
 * 
 * Clients send to:
 * /app/live/{roomId}/chat - Gửi tin nhắn
 * /app/live/{roomId}/join - Join room (tăng viewer count)
 * /app/live/{roomId}/leave - Leave room (giảm viewer count)
 */

@Slf4j
@Controller
@RequiredArgsConstructor
public class LiveWebSocketController {

    private final LiveService liveService;
    private final LiveChatRedisService liveChatRedisService;
    private final SimpMessagingTemplate messagingTemplate;

    // Track unique viewers per room using Set (prevents duplicate counting on
    // refresh)
    private final Map<String, Set<String>> roomViewerSets = new ConcurrentHashMap<>();

    /**
     * Xử lý tin nhắn chat từ client
     * Client gửi đến: /app/live/{roomId}/chat
     * Broadcast đến: /topic/live/{roomId}/chat
     */
    @MessageMapping("/live/{roomId}/chat")
    public void handleChat(
            @DestinationVariable String roomId,
            @Payload LiveChatRequest request,
            SimpMessageHeaderAccessor headerAccessor) {
        // Lấy thông tin user từ header
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "anonymous";

        // Ưu tiên username từ request (frontend gửi), fallback session attributes
        Map<String, Object> sessionAttrs = headerAccessor.getSessionAttributes();
        String username = request.getUsername();
        if (username == null || username.isEmpty()) {
            username = sessionAttrs != null ? (String) sessionAttrs.getOrDefault("username", "User") : "User";
        }

        // Ưu tiên avatarUrl từ request
        String avatarUrl = request.getAvatarUrl();
        if (avatarUrl == null && sessionAttrs != null) {
            avatarUrl = (String) sessionAttrs.get("avatarUrl");
        }

        // isOwner từ request
        Boolean isOwner = request.getIsOwner() != null ? request.getIsOwner() : false;

        log.info("Chat in room {}: {} from {} (isOwner: {})", roomId, request.getMessage(), username, isOwner);

        // Tạo chat DTO và broadcast
        LiveChatDto chatDto = LiveChatDto.builder()
                .liveRoomId(roomId)
                .userId(userId)
                .username(username)
                .avatarUrl(avatarUrl)
                .message(request.getMessage())
                .type(LiveChatType.CHAT)
                .isOwner(isOwner)
                .createdAt(LocalDateTime.now())
                .build();

        // Broadcast to all subscribers
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/chat", chatDto);

        // Lưu vào Redis
        try {
            liveChatRedisService.saveChat(roomId, chatDto);
        } catch (Exception e) {
            log.warn("Failed to save chat to Redis: {}", e.getMessage());
        }
    }

    /**
     * Xử lý khi user join room
     * Client gửi đến: /app/live/{roomId}/join
     */
    @MessageMapping("/live/{roomId}/join")
    public void handleJoin(
            @DestinationVariable String roomId,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "anonymous";

        log.info("User {} joined live room {}", userId, roomId);

        // Add user to viewer set (automatically deduplicates on refresh)
        Set<String> viewers = roomViewerSets.computeIfAbsent(roomId, k -> new ConcurrentSkipListSet<>());
        boolean isNewViewer = viewers.add(userId);
        int currentViewers = viewers.size();

        if (isNewViewer) {
            log.info("New viewer {} joined room {} (total: {})", userId, roomId, currentViewers);
        } else {
            log.info("Viewer {} rejoined room {} (no count increase, total: {})", userId, roomId, currentViewers);
        }

        // Broadcast viewer count
        broadcastViewerCount(roomId, currentViewers);

        // Update DB (async)
        try {
            liveService.updateViewerCount(roomId, currentViewers);
        } catch (Exception e) {
            log.warn("Failed to update viewer count in DB: {}", e.getMessage());
        }

        // Gửi system message
        LiveChatDto systemMsg = LiveChatDto.builder()
                .liveRoomId(roomId)
                .type(LiveChatType.SYSTEM)
                .message("A new person has just joined.!")
                .createdAt(LocalDateTime.now())
                .build();
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/chat", systemMsg);
    }

    /**
     * Xử lý khi user leave room
     * Client gửi đến: /app/live/{roomId}/leave
     */
    @MessageMapping("/live/{roomId}/leave")
    public void handleLeave(
            @DestinationVariable String roomId,
            SimpMessageHeaderAccessor headerAccessor) {
        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "anonymous";

        log.info("User {} left live room {}", userId, roomId);

        // Remove user from viewer set
        Set<String> viewers = roomViewerSets.get(roomId);
        if (viewers != null) {
            boolean wasRemoved = viewers.remove(userId);
            int currentViewers = viewers.size();

            if (wasRemoved) {
                log.info("Viewer {} left room {} (total: {})", userId, roomId, currentViewers);
            }

            // Broadcast viewer count
            broadcastViewerCount(roomId, currentViewers);

            // Update DB
            try {
                liveService.updateViewerCount(roomId, currentViewers);
            } catch (Exception e) {
                log.warn("Failed to update viewer count in DB: {}", e.getMessage());
            }
        }
    }

    /**
     * Xử lý reaction từ client (Tim, Like, Haha...)
     * Client gửi đến: /app/live/{roomId}/reaction
     * Broadcast đến: /topic/live/{roomId}/reaction
     */
    @MessageMapping("/live/{roomId}/reaction")
    public void handleReaction(
            @DestinationVariable String roomId,
            @Payload com.example.notificationservice.dto.LiveReactionDto request,
            SimpMessageHeaderAccessor headerAccessor) {

        Principal principal = headerAccessor.getUser();
        String userId = principal != null ? principal.getName() : "anonymous";

        // Thiết lập thông tin người gửi nếu chưa có
        if (request.getUserId() == null) {
            request.setUserId(userId);
        }

        // Có thể lấy thêm username/avatar từ session nếu cần,
        // nhưng reaction thường cần nhanh và ẩn danh hoặc chỉ hiện icon bay lên.

        // Broadcast ngay lập tức
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/reaction", request);
    }

    /**
     * Helper method to broadcast viewer count
     */
    private void broadcastViewerCount(String roomId, int count) {
        messagingTemplate.convertAndSend(
                "/topic/live/" + roomId + "/viewers",
                Map.of("count", count, "timestamp", LocalDateTime.now().toString()));
    }

    /**
     * Broadcast product update to all viewers in a room
     * Called from LiveService when products change
     */
    public void broadcastProductUpdate(String roomId) {
        try {
            var products = liveService.getProducts(roomId);
            messagingTemplate.convertAndSend("/topic/live/" + roomId + "/product", products);
        } catch (Exception e) {
            log.error("Failed to broadcast product update: {}", e.getMessage());
        }
    }

    /**
     * Broadcast order notification to all viewers
     */
    public void broadcastOrderNotification(String roomId, String username, String productName) {
        LiveChatDto orderMsg = LiveChatDto.builder()
                .liveRoomId(roomId)
                .type(LiveChatType.ORDER)
                .message("🎉 " + username + " vừa mua " + productName + "!")
                .createdAt(LocalDateTime.now())
                .build();

        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/order", orderMsg);
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/chat", orderMsg);
    }

    // /**
    // * Get current viewer count for a room
    // */
    // public int getViewerCount(String roomId) {
    // AtomicInteger viewers = roomViewers.get(roomId);
    // return viewers != null ? viewers.get() : 0;
    // }
    //
    // /**
    // * Reset viewer count when live ends
    // */
    // public void resetViewerCount(String roomId) {
    // roomViewers.remove(roomId);
    // }
}
