package com.example.userservice.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.userservice.enums.Active;
import com.example.userservice.model.User;

public interface UserRepository
        extends JpaRepository<User, String>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    List<User> findAllByActive(Active active);

    boolean existsByEmailIgnoreCase(String email);

    long countByActive(Active active);

    // NEW: Get all active user IDs for admin broadcast notifications
    @org.springframework.data.jpa.repository.Query("SELECT u.id FROM users u WHERE u.active = 'ACTIVE'")
    java.util.List<String> findAllActiveUserIds();
}
