package com.example.userservice.repository;

import com.example.userservice.enums.Active;
import com.example.userservice.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository
        extends JpaRepository<User, String>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);

    Optional<User> findByUsername(String username);

    List<User> findAllByActive(Active active);

    boolean existsByEmailIgnoreCase(String email);

    long countByActive(Active active);
}
