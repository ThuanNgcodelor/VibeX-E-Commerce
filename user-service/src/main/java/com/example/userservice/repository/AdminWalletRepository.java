package com.example.userservice.repository;

import com.example.userservice.model.AdminWallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminWalletRepository extends JpaRepository<AdminWallet, String> {
    Optional<AdminWallet> findByAdminId(String adminId);
}
