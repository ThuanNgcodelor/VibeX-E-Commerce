package com.example.userservice.repository;

import com.example.userservice.model.ShopOwner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShopOwnerRepository extends JpaRepository<ShopOwner, String> {
        Optional<ShopOwner> findByUserId(String userId);
}
