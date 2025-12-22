package com.example.orderservice.repository;

import com.example.orderservice.model.PlatformVoucher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformVoucherRepository extends JpaRepository<PlatformVoucher, String> {

    /**
     * Check if voucher code already exists
     */
    boolean existsByCode(String code);
}
