package com.example.orderservice.repository;

import com.example.orderservice.enums.OrderStatus;
import com.example.orderservice.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {
        @Query("SELECT SUM(oi.totalPrice) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.createdAt BETWEEN :startDate AND :endDate AND o.orderStatus = :status")
        Double sumSalesByProductIdsAndDateRangeAndStatus(@Param("productIds") List<String> productIds,
                        @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate,
                        @Param("status") OrderStatus status);

        List<Order> findByUserIdOrderByCreatedAtDesc(String userId);

        List<Order> findByOrderStatus(OrderStatus orderStatus);

        List<Order> findByCreatedAtBetween(LocalDateTime startDate, LocalDateTime endDate);

        @Query("select DISTINCT o from Order o " +
                        "inner join o.orderItems oi " +
                        "where oi.productId in :productIds")
        List<Order> findByOrderItemsProductIdIn(@Param("productIds") List<String> productIds);

        @Query("SELECT DISTINCT o FROM Order o " +
                        "INNER JOIN o.orderItems oi " +
                        "WHERE oi.productId IN :productIds")
        Page<Order> findByOrderItemsProductIdIn(@Param("productIds") List<String> productIds, Pageable pageable);

        @Query("SELECT DISTINCT o FROM Order o" +
                        " INNER JOIN o.orderItems oi " +
                        "WHERE oi.productId IN :productIds " +
                        "AND (:statuses IS NULL OR o.orderStatus IN :statuses) " +
                        "ORDER BY o.createdAt DESC")
        Page<Order> findByShopOwnerProducts(@Param("productIds") List<String> productIds, Pageable pageable,
                        @Param("statuses") List<OrderStatus> statuses);

        @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.orderStatus = :status")
        long countByProductIdsAndStatus(@Param("productIds") List<String> productIds,
                        @Param("status") OrderStatus status);

        @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.orderStatus IN :statuses")
        long countByProductIdsAndStatuses(@Param("productIds") List<String> productIds,
                        @Param("statuses") List<OrderStatus> statuses);

        @Query("SELECT SUM(oi.totalPrice) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.createdAt BETWEEN :startDate AND :endDate AND o.orderStatus NOT IN :excludedStatuses")
        Double sumSalesByProductIdsAndDateRange(@Param("productIds") List<String> productIds,
                        @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate,
                        @Param("excludedStatuses") List<OrderStatus> excludedStatuses);

        @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.createdAt BETWEEN :startDate AND :endDate AND o.orderStatus NOT IN :excludedStatuses")
        Long countByProductIdsAndCreatedAtBetween(@Param("productIds") List<String> productIds,
                        @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate,
                        @Param("excludedStatuses") List<OrderStatus> excludedStatuses);

        @Query("SELECT new com.example.orderservice.dto.TopProductDto(oi.productId, SUM(oi.quantity), SUM(oi.totalPrice)) "
                        +
                        "FROM Order o JOIN o.orderItems oi " +
                        "WHERE oi.productId IN :productIds AND o.orderStatus NOT IN :excludedStatuses " +
                        "GROUP BY oi.productId " +
                        "ORDER BY SUM(oi.quantity) DESC")
        List<com.example.orderservice.dto.TopProductDto> findTopSellingProducts(
                        @Param("productIds") List<String> productIds,
                        @Param("excludedStatuses") List<OrderStatus> excludedStatuses, Pageable pageable);

        @Query("SELECT COUNT(DISTINCT o) FROM Order o JOIN o.orderItems oi WHERE oi.productId IN :productIds AND o.createdAt BETWEEN :startDate AND :endDate AND o.orderStatus = :status")
        Long countByProductIdsAndDateRangeAndStatus(@Param("productIds") List<String> productIds,
                        @Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate,
                        @Param("status") OrderStatus status);

        @Query("SELECT new com.example.orderservice.dto.SuspiciousProductDto(" +
                        "oi.productId, '', '', '', " +
                        "COUNT(DISTINCT o), " +
                        "SUM(CASE WHEN o.orderStatus = 'CANCELLED' THEN 1 ELSE 0 END), " +
                        "0.0) " +
                        "FROM Order o JOIN o.orderItems oi " +
                        "WHERE o.createdAt >= :startDate " +
                        "GROUP BY oi.productId " +
                        "HAVING COUNT(DISTINCT o) >= :minOrders")
        List<com.example.orderservice.dto.SuspiciousProductDto> findSuspiciousProductsRaw(
                        @Param("startDate") LocalDateTime startDate,
                        @Param("minOrders") Long minOrders);

        // Query for Brushing: aggregated by productId, count distinct userId
        @Query("SELECT new com.example.orderservice.dto.SuspiciousProductDto(" +
                        "oi.productId, COUNT(o), COUNT(DISTINCT o.userId)) " +
                        "FROM Order o JOIN o.orderItems oi " +
                        "WHERE o.createdAt >= :startDate " +
                        "GROUP BY oi.productId " +
                        "HAVING COUNT(o) >= :minOrders")
        List<com.example.orderservice.dto.SuspiciousProductDto> findBrushingProductsRaw(
                        @Param("startDate") LocalDateTime startDate,
                        @Param("minOrders") Long minOrders);

        // Query for Price Manipulation: average unit price over last 30 days
        @Query("SELECT new com.example.orderservice.dto.SuspiciousProductDto(" +
                        "oi.productId, AVG(oi.unitPrice)) " +
                        "FROM Order o JOIN o.orderItems oi " +
                        "WHERE o.createdAt >= :startDate " +
                        "GROUP BY oi.productId ")
        List<com.example.orderservice.dto.SuspiciousProductDto> findProductAveragePriceRaw(
                        @Param("startDate") LocalDateTime startDate);

        // Dashboard Queries
        @Query("SELECT SUM(o.totalPrice) FROM Order o WHERE o.orderStatus = 'COMPLETED'")
        Double sumTotalRevenue();

        @Query("SELECT COUNT(o) FROM Order o WHERE o.orderStatus <> 'CANCELLED'")
        Long countAllValidOrders();

        @Query("SELECT new com.example.orderservice.dto.DailyRevenueDto(" +
                        "CAST(o.createdAt AS LocalDate), SUM(o.totalPrice), COUNT(o)) " +
                        "FROM Order o " +
                        "WHERE o.createdAt >= :startDate AND o.orderStatus = 'COMPLETED' " +
                        "GROUP BY CAST(o.createdAt AS LocalDate) " +
                        "ORDER BY CAST(o.createdAt AS LocalDate) ASC")
        List<com.example.orderservice.dto.DailyRevenueDto> getDailyRevenue(@Param("startDate") LocalDateTime startDate);
}