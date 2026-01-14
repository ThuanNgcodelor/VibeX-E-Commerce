package com.example.userservice.service.shopCoin;

import com.example.userservice.dto.ShopCoinDto;
import com.example.userservice.request.shopCoin.ShopCoinCheckInRequest;
import com.example.userservice.request.shopCoin.ShopCoinAddPointsRequest;
import com.example.userservice.dto.ShopCoinAdminDto;
import java.util.List;

public interface ShopCoinService {

        ShopCoinDto getUserShopCoin(String userId);

        ShopCoinDto dailyCheckIn(String userId, ShopCoinCheckInRequest request);

        ShopCoinDto addPoints(String userId, ShopCoinAddPointsRequest request);

        ShopCoinDto addGamePoints(String userId, int score);

        ShopCoinDto getOrCreateShopCoin(String userId);

        boolean hasCheckedInToday(String userId);

        org.springframework.data.domain.Page<ShopCoinAdminDto> getAllShopCoins(
                        org.springframework.data.domain.Pageable pageable);

        ShopCoinDto performViewProductMission(String userId);

        void performReviewMission(String userId);

        // Dynamic Mission System
        com.example.userservice.model.Mission createMission(
                        com.example.userservice.request.shopCoin.MissionRequest request);

        List<com.example.userservice.dto.MissionDto> getAllMissions();

        List<com.example.userservice.dto.UserMissionDto> getMissionsForUser(String userId);

        com.example.userservice.dto.UserMissionDto performMissionAction(String userId, String actionCode);

        ShopCoinDto claimMissionReward(String userId, String missionId);

        com.example.userservice.model.Mission updateMission(String id,
                        com.example.userservice.request.shopCoin.MissionRequest request);

        void deleteMission(String id);
}
