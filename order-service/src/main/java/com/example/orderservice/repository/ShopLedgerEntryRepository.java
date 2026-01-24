package com.example.orderservice.repository;

import com.example.orderservice.enums.LedgerEntryType;
import com.example.orderservice.model.ShopLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShopLedgerEntryRepository extends JpaRepository<ShopLedgerEntry, String> {
        List<ShopLedgerEntry> findByShopOwnerIdOrderByCreatedAtDesc(String shopOwnerId);

        List<ShopLedgerEntry> findByShopOwnerIdAndEntryTypeOrderByCreatedAtDesc(String shopOwnerId,
                        LedgerEntryType entryType);

        List<ShopLedgerEntry> findByOrderId(String orderId);

        boolean existsByRefTxn(String refTxn);

        org.springframework.data.domain.Page<ShopLedgerEntry> findByShopOwnerIdOrderByCreatedAtDesc(String shopOwnerId,
                        org.springframework.data.domain.Pageable pageable);
}
