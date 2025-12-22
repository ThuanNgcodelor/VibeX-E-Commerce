package com.example.userservice.repository;

import com.example.userservice.model.Identification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IdentificationRepository extends JpaRepository<Identification, String> {
    Optional<Identification> findByUserId(String userId);
}
