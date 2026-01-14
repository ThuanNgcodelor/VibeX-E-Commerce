package com.example.orderservice.repository;

import com.example.orderservice.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, String> {
    List<OrderItem> findByOrderId(String orderId);

    @Query("SELECT oi.productId, SUM(oi.totalPrice) FROM OrderItem oi " +
            "JOIN oi.order o WHERE o.orderStatus = 'COMPLETED' " +
            "GROUP BY oi.productId ORDER BY SUM(oi.totalPrice) DESC")
    List<Object[]> findTopSellingProducts();

    @Query("SELECT oi.productId, SUM(oi.totalPrice) FROM OrderItem oi " +
            "JOIN oi.order o WHERE o.orderStatus IN ('COMPLETED', 'DELIVERED') " +
            "AND o.createdAt BETWEEN :startDate AND :endDate " +
            "GROUP BY oi.productId ORDER BY SUM(oi.totalPrice) DESC")
    List<Object[]> findTopSellingProductsBetween(@Param("startDate") java.time.LocalDateTime startDate,
            @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT DISTINCT oi.order.id FROM OrderItem oi WHERE oi.productId IN :productIds")
    Set<OrderItem> findDistinctOrderIdsByProductIdIn(@Param("productIds") List<String> productIds);

    List<OrderItem> findByProductId(String productId);
}
