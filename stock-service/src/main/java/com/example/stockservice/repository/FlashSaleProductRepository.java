package com.example.stockservice.repository;

import com.example.stockservice.enums.FlashSaleStatus;
import com.example.stockservice.model.FlashSaleProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FlashSaleProductRepository extends JpaRepository<FlashSaleProduct, String> {
    List<FlashSaleProduct> findBySessionId(String sessionId);

    List<FlashSaleProduct> findBySessionIdAndStatus(String sessionId, FlashSaleStatus status);

    List<FlashSaleProduct> findByShopId(String shopId);

    List<FlashSaleProduct> findByProductIdAndStatus(String productId, FlashSaleStatus status);

    int countBySessionId(String sessionId);

    List<FlashSaleProduct> findByProductId(String productId);
}
