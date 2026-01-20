package com.example.userservice.repository;

import com.example.userservice.model.ShopFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ShopFollowRepository extends JpaRepository<ShopFollow, String> {
    long countByShopId(String shopId);

    boolean existsByFollowerIdAndShopId(String followerId, String shopId);

    void deleteByFollowerIdAndShopId(String followerId, String shopId);

    long countByFollowerId(String followerId);

    // NEW: Get all followers of a shop
    List<ShopFollow> findAllByShopId(String shopId);

    // NEW: Get only follower IDs for a shop (optimized query)
    @Query("SELECT sf.followerId FROM ShopFollow sf WHERE sf.shopId = :shopId")
    List<String> findFollowerIdsByShopId(@Param("shopId") String shopId);
}
