package com.example.stockservice.repository;

import com.example.stockservice.model.analytics.ProductAnalytics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductAnalyticsRepository extends JpaRepository<ProductAnalytics, String> {

    @Query("SELECT SUM(pa.viewCount) FROM product_analytics pa WHERE pa.shopId = :shopId")
    Long countTotalViewsByShopId(String shopId);

    @Query("SELECT SUM(pa.viewCount) FROM product_analytics pa")
    Long countTotalSystemViews();

    List<ProductAnalytics> findByShopId(String shopId);
}
