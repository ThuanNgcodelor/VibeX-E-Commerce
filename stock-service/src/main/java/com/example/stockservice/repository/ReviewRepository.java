package com.example.stockservice.repository;

import com.example.stockservice.model.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface ReviewRepository extends JpaRepository<Review, String> {
    List<Review> findByProductIdOrderByCreatedAtDesc(String productId);

    List<Review> findByProductId(String productId);

    List<Review> findByUserId(String userId);

    @Query("SELECT AVG(r.rating) FROM reviews r, products p WHERE r.productId = p.id AND p.userId = :userId")
    Double getAverageRatingByShopId(@Param("userId") String userId);

    @Query("SELECT count(r) FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId)")
    long countReviewsByShopId(@Param("shopId") String shopId);

    @Query("SELECT r FROM reviews r WHERE r.productId IN (SELECT p.id FROM products p WHERE p.userId = :shopId) ORDER BY r.createdAt DESC")
    List<Review> findByShopId(@Param("shopId") String shopId);

    boolean existsByUserIdAndCreatedAtBetween(String userId, java.time.LocalDateTime start,
                                              java.time.LocalDateTime end);
}