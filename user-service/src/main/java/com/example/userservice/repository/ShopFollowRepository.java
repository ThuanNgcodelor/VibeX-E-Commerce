package com.example.userservice.repository;

import com.example.userservice.model.ShopFollow;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShopFollowRepository extends JpaRepository<ShopFollow, String> {
    long countByShopId(String shopId);

    boolean existsByFollowerIdAndShopId(String followerId, String shopId);

    void deleteByFollowerIdAndShopId(String followerId, String shopId);

    long countByFollowerId(String followerId);
}
