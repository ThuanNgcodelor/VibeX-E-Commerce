package com.example.notificationservice.repository;

import com.example.notificationservice.enums.LiveStatus;
import com.example.notificationservice.model.LiveRoom;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveRoomRepository extends JpaRepository<LiveRoom, String> {
    
    // Find by shop owner
    List<LiveRoom> findByShopOwnerIdOrderByCreatedAtDesc(String shopOwnerId);
    
    Page<LiveRoom> findByShopOwnerId(String shopOwnerId, Pageable pageable);
    
    // Find by status
    List<LiveRoom> findByStatusOrderByViewerCountDesc(LiveStatus status);
    
    Page<LiveRoom> findByStatus(LiveStatus status, Pageable pageable);
    
    // Find live rooms (currently streaming)
    @Query("SELECT lr FROM LiveRoom lr WHERE lr.status = 'LIVE' ORDER BY lr.viewerCount DESC")
    List<LiveRoom> findAllLiveRooms();
    
    @Query("SELECT lr FROM LiveRoom lr WHERE lr.status = 'LIVE' ORDER BY lr.viewerCount DESC")
    Page<LiveRoom> findAllLiveRooms(Pageable pageable);
    
    // Find by stream key (for RTMP callback)
    Optional<LiveRoom> findByStreamKey(String streamKey);
    
    // Check if shop owner has an active live room
    @Query("SELECT COUNT(lr) > 0 FROM LiveRoom lr WHERE lr.shopOwnerId = :shopOwnerId AND lr.status = 'LIVE'")
    boolean hasActiveLiveRoom(@Param("shopOwnerId") String shopOwnerId);
    
    // Update viewer count
    @Modifying
    @Query("UPDATE LiveRoom lr SET lr.viewerCount = :count, lr.peakViewers = CASE WHEN :count > lr.peakViewers THEN :count ELSE lr.peakViewers END WHERE lr.id = :roomId")
    void updateViewerCount(@Param("roomId") String roomId, @Param("count") int count);
    
    // Update order stats
    @Modifying
    @Query("UPDATE LiveRoom lr SET lr.totalOrders = lr.totalOrders + 1, lr.totalRevenue = lr.totalRevenue + :amount WHERE lr.id = :roomId")
    void incrementOrderStats(@Param("roomId") String roomId, @Param("amount") double amount);
}
