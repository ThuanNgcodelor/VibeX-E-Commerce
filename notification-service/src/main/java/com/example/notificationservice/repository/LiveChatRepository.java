package com.example.notificationservice.repository;

import com.example.notificationservice.model.LiveChat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LiveChatRepository extends JpaRepository<LiveChat, String> {
    
    // Find chats in a live room with pagination
    Page<LiveChat> findByLiveRoomIdOrderByCreatedAtDesc(String liveRoomId, Pageable pageable);
    
    // Find recent chats (for initial load)
    List<LiveChat> findTop50ByLiveRoomIdOrderByCreatedAtDesc(String liveRoomId);
    
    // Find pinned messages
    List<LiveChat> findByLiveRoomIdAndIsPinnedTrueOrderByCreatedAtDesc(String liveRoomId);
    
    // Find chats after a certain time (for polling fallback)
    List<LiveChat> findByLiveRoomIdAndCreatedAtAfterOrderByCreatedAtAsc(String liveRoomId, LocalDateTime after);
    
    // Count chats in room
    long countByLiveRoomId(String liveRoomId);
    
    // Delete old chats (cleanup job)
    @Query("DELETE FROM LiveChat lc WHERE lc.liveRoomId = :roomId AND lc.createdAt < :before")
    void deleteOldChats(@Param("roomId") String roomId, @Param("before") LocalDateTime before);
}
