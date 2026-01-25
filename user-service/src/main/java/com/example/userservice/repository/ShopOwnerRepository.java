package com.example.userservice.repository;

import com.example.userservice.model.ShopOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShopOwnerRepository extends JpaRepository<ShopOwner, String> {
        Optional<ShopOwner> findByUserId(String userId);

        org.springframework.data.domain.Page<ShopOwner> findByShopNameContainingIgnoreCaseOrOwnerNameContainingIgnoreCase(
                        String shopName, String ownerName, org.springframework.data.domain.Pageable pageable);

        // Filter by verified = true
        org.springframework.data.domain.Page<ShopOwner> findByVerifiedTrue(
                        org.springframework.data.domain.Pageable pageable);

        org.springframework.data.domain.Page<ShopOwner> findByShopNameContainingIgnoreCaseOrOwnerNameContainingIgnoreCaseAndVerifiedTrue(
                        String shopName, String ownerName, org.springframework.data.domain.Pageable pageable);

        // Filter by User Role = SHOP_OWNER
        @org.springframework.data.jpa.repository.Query("SELECT s FROM ShopOwner s JOIN s.user u JOIN u.roles r WHERE r = 'SHOP_OWNER'")
        org.springframework.data.domain.Page<ShopOwner> findAllShopOwnersWithRole(
                        org.springframework.data.domain.Pageable pageable);

        @org.springframework.data.jpa.repository.Query("SELECT s FROM ShopOwner s JOIN s.user u JOIN u.roles r WHERE r = 'SHOP_OWNER' AND (LOWER(s.shopName) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(s.ownerName) LIKE LOWER(CONCAT('%', :search, '%')))")
        org.springframework.data.domain.Page<ShopOwner> findBySearchAndRoleShopOwner(
                        @org.springframework.data.repository.query.Param("search") String search,
                        org.springframework.data.domain.Pageable pageable);

}
