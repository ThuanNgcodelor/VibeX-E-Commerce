package com.example.userservice.repository;

import com.example.userservice.dto.UserLocationStatDto;
import com.example.userservice.model.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AddressRepository extends JpaRepository<Address, String> {
    List<Address> findAllByUserId(String userId);

    Optional<Address> findByUserIdAndIsDefaultTrue(String userId);

    @Query("SELECT new com.example.userservice.dto.UserLocationStatDto(a.provinceName, COUNT(distinct a.userId)) " +
            "FROM Address a WHERE a.isDefault = true AND a.provinceName IS NOT NULL " +
            "GROUP BY a.provinceName ORDER BY COUNT(distinct a.userId) DESC")
    List<UserLocationStatDto> getUserLocationStats();
}
