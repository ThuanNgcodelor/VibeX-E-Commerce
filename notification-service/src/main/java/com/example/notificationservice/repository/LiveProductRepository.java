package com.example.notificationservice.repository;

import com.example.notificationservice.model.LiveProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveProductRepository extends JpaRepository<LiveProduct, String> {
    
    // Find all products in a live room
    List<LiveProduct> findByLiveRoomIdOrderByDisplayOrderAsc(String liveRoomId);
    
    // Find featured product in a live room
    Optional<LiveProduct> findByLiveRoomIdAndIsFeaturedTrue(String liveRoomId);
    
    // Find by live room and product id
    Optional<LiveProduct> findByLiveRoomIdAndProductId(String liveRoomId, String productId);
    
    // Check if product already added to live room
    boolean existsByLiveRoomIdAndProductId(String liveRoomId, String productId);
    
    // Count products in live room
    long countByLiveRoomId(String liveRoomId);
    
    // Clear featured flag for all products in a room
    @Modifying
    @Query("UPDATE LiveProduct lp SET lp.isFeatured = false WHERE lp.liveRoom.id = :roomId")
    void clearFeaturedInRoom(@Param("roomId") String roomId);
    
    // Increment sold count
    @Modifying
    @Query("UPDATE LiveProduct lp SET lp.soldCount = lp.soldCount + :quantity WHERE lp.id = :productId")
    void incrementSoldCount(@Param("productId") String productId, @Param("quantity") int quantity);
    
    // Update stock available
    @Modifying
    @Query("UPDATE LiveProduct lp SET lp.stockAvailable = lp.stockAvailable - :quantity WHERE lp.id = :productId AND lp.stockAvailable >= :quantity")
    int decreaseStock(@Param("productId") String productId, @Param("quantity") int quantity);
    
    // Delete all products in a live room
    void deleteByLiveRoomId(String liveRoomId);
}
