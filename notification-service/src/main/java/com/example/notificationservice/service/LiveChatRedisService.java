package com.example.notificationservice.service;

import com.example.notificationservice.dto.LiveChatDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Service để lưu trữ Live Chat trong Redis
 * Flow:
 * 1. Shop owner/viewer gửi chat qua WebSocket -> LiveWebSocketController
 * 2. LiveWebSocketController gọi LiveChatRedisService.saveChat()
 * 3. Chat được lưu vào Redis List với key: "live:chat:{roomId}"
 * 4. Chỉ lưu 100 tin nhắn gần nhất (FIFO)
 * 5. TTL = 24h (tự động xóa sau khi live kết thúc)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LiveChatRedisService {
    
    private final RedisTemplate<String, Object> redisTemplate;
    
    private static final String CHAT_KEY_PREFIX = "live:chat:";
    private static final String VIEWER_KEY_PREFIX = "live:viewers:";
    private static final int MAX_CHAT_MESSAGES = 100;
    private static final long CHAT_TTL_HOURS = 24;
    
    /**
     * Lưu tin nhắn chat vào Redis
     * @param roomId ID của phòng live
     * @param chat DTO chứa thông tin chat
     */
    public void saveChat(String roomId, LiveChatDto chat) {
        String key = CHAT_KEY_PREFIX + roomId;
        
        try {
            // Thêm chat vào cuối list
            redisTemplate.opsForList().rightPush(key, chat);
            
            // Giữ chỉ MAX_CHAT_MESSAGES tin nhắn gần nhất
            Long size = redisTemplate.opsForList().size(key);
            if (size != null && size > MAX_CHAT_MESSAGES) {
                redisTemplate.opsForList().trim(key, size - MAX_CHAT_MESSAGES, -1);
            }
            
            // Set TTL nếu chưa có
            if (!redisTemplate.hasKey(key + ":ttl")) {
                redisTemplate.expire(key, CHAT_TTL_HOURS, TimeUnit.HOURS);
                redisTemplate.opsForValue().set(key + ":ttl", "1", Duration.ofHours(CHAT_TTL_HOURS));
            }
            
            log.debug("Saved chat to Redis for room {}: {}", roomId, chat.getMessage());
        } catch (Exception e) {
            log.error("Error saving chat to Redis: {}", e.getMessage());
        }
    }
    
    /**
     * Lấy danh sách tin nhắn chat gần nhất
     * @param roomId ID của phòng live
     * @param limit Số lượng tin nhắn tối đa
     * @return Danh sách tin nhắn
     */
    public List<LiveChatDto> getRecentChats(String roomId, int limit) {
        String key = CHAT_KEY_PREFIX + roomId;
        
        try {
            Long size = redisTemplate.opsForList().size(key);
            if (size == null || size == 0) {
                return new ArrayList<>();
            }
            
            long start = Math.max(0, size - limit);
            List<Object> objects = redisTemplate.opsForList().range(key, start, -1);
            
            if (objects == null) {
                return new ArrayList<>();
            }
            
            List<LiveChatDto> chats = new ArrayList<>();
            for (Object obj : objects) {
                if (obj instanceof LiveChatDto) {
                    chats.add((LiveChatDto) obj);
                }
            }
            return chats;
        } catch (Exception e) {
            log.error("Error getting chats from Redis: {}", e.getMessage());
            return new ArrayList<>();
        }
    }
    
    /**
     * Xóa tất cả chat của phòng (khi live kết thúc)
     */
    public void clearRoomChats(String roomId) {
        String key = CHAT_KEY_PREFIX + roomId;
        redisTemplate.delete(key);
        redisTemplate.delete(key + ":ttl");
        log.info("Cleared chats for room {}", roomId);
    }
    
    /**
     * Lưu số lượng viewer
     */
    public void saveViewerCount(String roomId, int count) {
        String key = VIEWER_KEY_PREFIX + roomId;
        redisTemplate.opsForValue().set(key, count, Duration.ofHours(CHAT_TTL_HOURS));
    }
    
    /**
     * Lấy số lượng viewer
     */
    public int getViewerCount(String roomId) {
        String key = VIEWER_KEY_PREFIX + roomId;
        Object count = redisTemplate.opsForValue().get(key);
        if (count instanceof Integer) {
            return (Integer) count;
        }
        return 0;
    }
}
