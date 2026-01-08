package com.example.userservice.repository;

import com.example.userservice.model.AdminWalletEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminWalletEntryRepository extends JpaRepository<AdminWalletEntry, String> {
    Page<AdminWalletEntry> findByAdminWalletId(String adminWalletId, Pageable pageable);
}
