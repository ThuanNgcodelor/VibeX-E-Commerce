package com.example.userservice.repository.shopCoin;

import com.example.userservice.model.ShopCoin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface ShopCoinRepository extends JpaRepository<ShopCoin, String> {
    
    Optional<ShopCoin> findByUserId(String userId);
    
    @Query("SELECT sc FROM shop_coins sc WHERE sc.userId = :userId AND sc.checkInDate = :date")
    Optional<ShopCoin> findByUserIdAndCheckInDate(
            @Param("userId") String userId,
            @Param("date") LocalDate date
    );
    
    @Query("SELECT sc FROM shop_coins sc WHERE sc.userId = :userId AND sc.lastCheckInDate = CURRENT_DATE")
    Optional<ShopCoin> findByUserIdAndCheckedInToday(@Param("userId") String userId);
}
