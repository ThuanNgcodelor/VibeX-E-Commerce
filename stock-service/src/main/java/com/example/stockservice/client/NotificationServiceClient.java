package com.example.stockservice.client;

import com.example.stockservice.dto.LiveRoomDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

/**
 * Feign Client to communicate with notification-service
 * For querying live streaming sessions
 */
@FeignClient(name = "notification-service", path = "/v1/notifications")
public interface NotificationServiceClient {

    /**
     * Get all active live rooms
     */
    @GetMapping("/api/live")
    ResponseEntity<List<LiveRoomDto>> getActiveLiveRooms(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size);
    /**
     * Get live room details by ID
     */
    @GetMapping("/api/live/{roomId}")
    ResponseEntity<LiveRoomDto> getLiveRoom(@PathVariable String roomId);

    @PostMapping("/v1/notifications/broadcast/shops")
    void broadcastToShops(@RequestParam("message") String message, @RequestParam("title") String title);
}
