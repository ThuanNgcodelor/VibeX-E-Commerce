package com.example.userservice.repository.shopCoin;

import com.example.userservice.model.Mission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MissionRepository extends JpaRepository<Mission, String> {
    Optional<Mission> findByActionCode(String actionCode);
}
