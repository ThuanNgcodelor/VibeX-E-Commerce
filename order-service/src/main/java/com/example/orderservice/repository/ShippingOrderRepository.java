package com.example.orderservice.repository;

import com.example.orderservice.model.ShippingOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShippingOrderRepository extends JpaRepository<ShippingOrder, String> {
    Optional<ShippingOrder> findByOrderId(String orderId);
    Optional<ShippingOrder> findByGhnOrderCode(String ghnOrderCode);
    
    /**
     * Find all active shipping orders that need status polling
     * Active = has GHN order code and not in terminal states (DELIVERED, CANCELLED, RETURNED)
     */
    @Query("SELECT s FROM ShippingOrder s WHERE s.ghnOrderCode IS NOT NULL " +
           "AND (s.status IS NULL OR UPPER(s.status) NOT IN ('DELIVERED', 'CANCELLED', 'RETURNED', 'RETURN', 'RETURNING'))")
    List<ShippingOrder> findActiveShippingOrders();
}

