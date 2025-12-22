package com.example.userservice.repository;

import com.example.userservice.model.TaxInfo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TaxInfoRepository extends JpaRepository<TaxInfo, String> {
    Optional<TaxInfo> findByUserId(String userId);
}
