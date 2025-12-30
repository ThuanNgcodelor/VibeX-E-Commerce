package com.example.userservice.repository;

import com.example.userservice.model.ShopDecoration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShopDecorationRepository extends JpaRepository<ShopDecoration, Long> {
    Optional<ShopDecoration> findByShopId(String shopId);
}
