package com.example.stockservice.repository;

import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleProductSize;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FlashSaleProductSizeRepository extends JpaRepository<FlashSaleProductSize, String> {
    List<FlashSaleProductSize> findByFlashSaleProduct(FlashSaleProduct flashSaleProduct);

    void deleteByFlashSaleProduct(FlashSaleProduct flashSaleProduct);
}
