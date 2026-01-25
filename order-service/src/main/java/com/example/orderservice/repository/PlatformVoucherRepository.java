package com.example.orderservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.example.orderservice.model.PlatformVoucher;

@Repository
public interface PlatformVoucherRepository extends JpaRepository<PlatformVoucher, String> {

    /**
     * Check if voucher code already exists
     */
    boolean existsByCode(String code);

    /**
     * Find by code (ignoring status)
     */
    java.util.Optional<PlatformVoucher> findByCode(String code);

    /**
     * Find active voucher by code
     */
    @org.springframework.data.jpa.repository.Query("SELECT v FROM PlatformVoucher v WHERE v.code = :code AND v.status = 'ACTIVE'")
    java.util.Optional<PlatformVoucher> findByCodeAndStatus(String code);
}
