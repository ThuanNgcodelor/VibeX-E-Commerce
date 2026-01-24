package com.example.stockservice.repository.analytics;

import com.example.stockservice.enums.EventType;
import com.example.stockservice.model.analytics.BehaviorLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for BehaviorLog entity - stores detailed user behavior events
 */
@Repository
public interface BehaviorLogRepository extends JpaRepository<BehaviorLog, String> {

       /**
        * Find all logs for a specific user
        */
       List<BehaviorLog> findByUserIdOrderByCreatedTimestampDesc(String userId);

       /**
        * Find logs by product ID
        */
       List<BehaviorLog> findByProductIdOrderByCreatedTimestampDesc(String productId);

       /**
        * Find logs by shop ID
        */
       List<BehaviorLog> findByShopIdOrderByCreatedTimestampDesc(String shopId);

       /**
        * Find logs by event type
        */
       List<BehaviorLog> findByEventTypeOrderByCreatedTimestampDesc(EventType eventType);

       /**
        * Count events by product and type
        */
       long countByProductIdAndEventType(String productId, EventType eventType);

       /**
        * Count events by shop and type within a time range
        */
       @Query("SELECT COUNT(b) FROM behavior_logs b WHERE b.shopId = :shopId AND b.eventType = :eventType " +
                     "AND b.createdTimestamp >= :startDate AND b.createdTimestamp <= :endDate")
       long countByShopIdAndEventTypeAndDateRange(
                     @Param("shopId") String shopId,
                     @Param("eventType") EventType eventType,
                     @Param("startDate") LocalDateTime startDate,
                     @Param("endDate") LocalDateTime endDate);

       /**
        * Get recent product views for a user (for recommendations)
        */
       @Query("SELECT DISTINCT b.productId FROM behavior_logs b WHERE b.userId = :userId " +
                     "AND b.eventType = 'VIEW' ORDER BY b.createdTimestamp DESC")
       List<String> findRecentViewedProductIds(@Param("userId") String userId);

       /**
        * Get top searched keywords
        */
       @Query("SELECT b.searchKeyword, COUNT(b) as cnt FROM behavior_logs b " +
                     "WHERE b.eventType = 'SEARCH' AND b.searchKeyword IS NOT NULL " +
                     "GROUP BY b.searchKeyword ORDER BY cnt DESC")
       List<Object[]> findTopSearchKeywords();
}
