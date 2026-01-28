package com.example.stockservice.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.example.stockservice.model.Review;

@Repository
public interface ReviewRepository extends JpaRepository<Review, String> {
    List<Review> findByProductIdOrderByCreatedAtDesc(String productId);

    List<Review> findByProductId(String productId);

    List<Review> findByUserId(String userId);

    @Query("SELECT AVG(r.rating) FROM reviews r, products p WHERE r.productId = p.id AND p.userId = :userId")
    Double getAverageRatingByShopId(@Param("userId") String userId);

    @Query("SELECT AVG(r.rating) FROM reviews r WHERE r.productId = :productId")
    Double getAverageRatingByProductId(@Param("productId") String productId);

    @Query("SELECT count(r) FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId)")
    long countReviewsByShopId(@Param("shopId") String shopId);

    @Query("SELECT count(r) FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) AND ((r.comment IS NOT NULL AND r.comment <> '') OR (size(r.imageIds) > 0))")
    long countVisibleReviewsByShopId(@Param("shopId") String shopId);

    @Query("SELECT count(r) FROM reviews r WHERE r.reply IS NOT NULL AND r.reply <> '' AND r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) AND ((r.comment IS NOT NULL AND r.comment <> '') OR (size(r.imageIds) > 0))")
    long countRepliedReviewsByShopId(@Param("shopId") String shopId);

    @Query("SELECT r FROM reviews r WHERE r.reply IS NOT NULL AND r.reply <> '' AND r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) AND ((r.comment IS NOT NULL AND r.comment <> '') OR (size(r.imageIds) > 0))")
    List<Review> findRepliedReviewsByShopId(@Param("shopId") String shopId);

    @Query("SELECT r FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) ORDER BY r.createdAt DESC")
    Page<Review> findByShopId(@Param("shopId") String shopId, Pageable pageable);

    @Query("SELECT r FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) ORDER BY r.createdAt DESC")
    List<Review> findByShopId(@Param("shopId") String shopId);

    boolean existsByUserIdAndCreatedAtBetween(String userId, java.time.LocalDateTime start,
            java.time.LocalDateTime end);
}