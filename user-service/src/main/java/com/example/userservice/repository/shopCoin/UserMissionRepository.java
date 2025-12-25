package com.example.userservice.repository.shopCoin;

import com.example.userservice.model.UserMission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserMissionRepository extends JpaRepository<UserMission, String> {
    List<UserMission> findByUserId(String userId);

    Optional<UserMission> findByUserIdAndMissionId(String userId, String missionId);
}
