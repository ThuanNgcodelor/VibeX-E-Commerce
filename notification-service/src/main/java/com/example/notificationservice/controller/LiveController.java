package com.example.notificationservice.controller;

import com.example.notificationservice.dto.LiveChatDto;
import com.example.notificationservice.dto.LiveProductDto;
import com.example.notificationservice.dto.LiveRoomDto;
import com.example.notificationservice.jwt.JwtUtil;
import com.example.notificationservice.request.AddLiveProductRequest;
import com.example.notificationservice.request.CreateLiveRoomRequest;
import com.example.notificationservice.request.LiveChatRequest;
import com.example.notificationservice.service.LiveService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/notifications/live")
public class LiveController {
    
    private final LiveService liveService;
    private final JwtUtil jwtUtil;
    
    // ==================== ROOM MANAGEMENT ====================
    
    /**
     * Tạo phòng live mới
     * POST /v1/notifications/live/rooms
     */
    @PostMapping("/rooms")
    public ResponseEntity<LiveRoomDto> createLiveRoom(
            @Valid @RequestBody CreateLiveRoomRequest request,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveRoomDto room = liveService.createLiveRoom(shopOwnerId, request);
        return ResponseEntity.ok(room);
    }
    
    /**
     * Lấy chi tiết phòng live (public)
     * GET /v1/notifications/live/rooms/{id}
     */
    @GetMapping("/rooms/{id}")
    public ResponseEntity<LiveRoomDto> getLiveRoom(@PathVariable String id) {
        LiveRoomDto room = liveService.getLiveRoom(id);
        return ResponseEntity.ok(room);
    }
    
    /**
     * Lấy chi tiết phòng live với stream key (chỉ shop owner)
     * GET /v1/notifications/live/rooms/{id}/details
     */
    @GetMapping("/rooms/{id}/details")
    public ResponseEntity<LiveRoomDto> getLiveRoomDetails(
            @PathVariable String id,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveRoomDto room = liveService.getLiveRoomWithStreamKey(id, shopOwnerId);
        return ResponseEntity.ok(room);
    }
    
    /**
     * Danh sách phòng đang live
     * GET /v1/notifications/live/rooms
     */
    @GetMapping("/rooms")
    public ResponseEntity<Page<LiveRoomDto>> getLiveRooms(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<LiveRoomDto> rooms = liveService.getLiveRooms(pageable);
        return ResponseEntity.ok(rooms);
    }
    
    /**
     * Danh sách phòng của shop owner
     * GET /v1/notifications/live/my-rooms
     */
    @GetMapping("/my-rooms")
    public ResponseEntity<Page<LiveRoomDto>> getMyLiveRooms(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        Pageable pageable = PageRequest.of(page, size);
        Page<LiveRoomDto> rooms = liveService.getMyLiveRooms(shopOwnerId, pageable);
        return ResponseEntity.ok(rooms);
    }
    
    /**
     * Bắt đầu live
     * PUT /v1/notifications/live/rooms/{id}/start
     */
    @PutMapping("/rooms/{id}/start")
    public ResponseEntity<LiveRoomDto> startLive(
            @PathVariable String id,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveRoomDto room = liveService.startLive(id, shopOwnerId);
        return ResponseEntity.ok(room);
    }
    
    /**
     * Kết thúc live
     * PUT /v1/notifications/live/rooms/{id}/end
     */
    @PutMapping("/rooms/{id}/end")
    public ResponseEntity<LiveRoomDto> endLive(
            @PathVariable String id,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveRoomDto room = liveService.endLive(id, shopOwnerId);
        return ResponseEntity.ok(room);
    }
    
    // ==================== RTMP CALLBACKS ====================
    
    /**
     * Nginx-RTMP callback khi stream bắt đầu
     * POST /v1/notifications/live/callback/start
     */
    @PostMapping("/callback/start")
    public ResponseEntity<String> handleStreamStart(@RequestParam String name) {
        log.info("RTMP callback: stream start for {}", name);
        liveService.handleStreamStart(name);
        return ResponseEntity.ok("OK");
    }
    
    /**
     * Nginx-RTMP callback khi stream kết thúc
     * POST /v1/notifications/live/callback/end
     */
    @PostMapping("/callback/end")
    public ResponseEntity<String> handleStreamEnd(@RequestParam String name) {
        log.info("RTMP callback: stream end for {}", name);
        liveService.handleStreamEnd(name);
        return ResponseEntity.ok("OK");
    }
    
    // ==================== PRODUCT MANAGEMENT ====================
    
    /**
     * Thêm sản phẩm vào live room
     * POST /v1/notifications/live/rooms/{id}/products
     */
    @PostMapping("/rooms/{id}/products")
    public ResponseEntity<LiveProductDto> addProduct(
            @PathVariable String id,
            @Valid @RequestBody AddLiveProductRequest request,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveProductDto product = liveService.addProduct(id, shopOwnerId, request);
        return ResponseEntity.ok(product);
    }
    
    /**
     * Lấy danh sách sản phẩm trong live room
     * GET /v1/notifications/live/rooms/{id}/products
     */
    @GetMapping("/rooms/{id}/products")
    public ResponseEntity<List<LiveProductDto>> getProducts(@PathVariable String id) {
        List<LiveProductDto> products = liveService.getProducts(id);
        return ResponseEntity.ok(products);
    }
    
    /**
     * Highlight sản phẩm
     * PUT /v1/notifications/live/rooms/{id}/products/{productId}/feature
     */
    @PutMapping("/rooms/{id}/products/{productId}/feature")
    public ResponseEntity<LiveProductDto> featureProduct(
            @PathVariable String id,
            @PathVariable String productId,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        LiveProductDto product = liveService.featureProduct(id, productId, shopOwnerId);
        return ResponseEntity.ok(product);
    }
    
    /**
     * Xóa sản phẩm khỏi live room
     * DELETE /v1/notifications/live/rooms/{id}/products/{productId}
     */
    @DeleteMapping("/rooms/{id}/products/{productId}")
    public ResponseEntity<Void> removeProduct(
            @PathVariable String id,
            @PathVariable String productId,
            HttpServletRequest httpRequest
    ) {
        String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);
        liveService.removeProduct(id, productId, shopOwnerId);
        return ResponseEntity.ok().build();
    }
    
    // ==================== CHAT ====================
    
    /**
     * Gửi tin nhắn chat (REST fallback)
     * POST /v1/notifications/live/rooms/{id}/chat
     */
    @PostMapping("/rooms/{id}/chat")
    public ResponseEntity<LiveChatDto> sendChat(
            @PathVariable String id,
            @Valid @RequestBody LiveChatRequest request,
            HttpServletRequest httpRequest
    ) {
        String userId = jwtUtil.ExtractUserId(httpRequest);
        // TODO: Get username and avatar from user-service
        String username = "User";
        String avatarUrl = null;
        
        LiveChatDto chat = liveService.sendChat(id, userId, username, avatarUrl, request);
        return ResponseEntity.ok(chat);
    }
    
    /**
     * Lấy tin nhắn gần đây
     * GET /v1/notifications/live/rooms/{id}/chat
     */
    @GetMapping("/rooms/{id}/chat")
    public ResponseEntity<List<LiveChatDto>> getRecentChats(@PathVariable String id) {
        List<LiveChatDto> chats = liveService.getRecentChats(id);
        return ResponseEntity.ok(chats);
    }
    
    // ==================== VIEWER COUNT ====================
    
    /**
     * Cập nhật số người xem (WebSocket will handle this, REST for testing)
     * PUT /v1/notifications/live/rooms/{id}/viewers
     */
    @PutMapping("/rooms/{id}/viewers")
    public ResponseEntity<Void> updateViewerCount(
            @PathVariable String id,
            @RequestBody Map<String, Integer> body
    ) {
        Integer count = body.get("count");
        if (count != null) {
            liveService.updateViewerCount(id, count);
        }
        return ResponseEntity.ok().build();
    }
}
