package com.example.userservice.service.shopCoin;

import java.time.LocalDate;

import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.example.userservice.client.StockServiceClient;
import com.example.userservice.dto.ShopCoinDto;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.ShopCoin;
import com.example.userservice.repository.shopCoin.ShopCoinRepository;
import com.example.userservice.request.shopCoin.ShopCoinAddPointsRequest;
import com.example.userservice.request.shopCoin.ShopCoinCheckInRequest;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopCoinServiceImpl implements ShopCoinService {

    private final ShopCoinRepository shopCoinRepository;
    private final com.example.userservice.repository.shopCoin.MissionRepository missionRepository;
    private final com.example.userservice.repository.shopCoin.UserMissionRepository userMissionRepository;
    private final ModelMapper modelMapper;
    private final StockServiceClient stockServiceClient;

    private static final Long DEFAULT_CHECKIN_POINTS = 10L;

    @Override
    @Transactional(readOnly = true)
    public ShopCoinDto getUserShopCoin(String userId) {
        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("ShopCoin not found for user: " + userId));
        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    @Override
    @Transactional
    public ShopCoinDto dailyCheckIn(String userId, ShopCoinCheckInRequest request) {
        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseGet(() -> createNewShopCoin(userId));

        // Check if already checked in today
        if (shopCoin.getLastCheckInDate() != null &&
                shopCoin.getLastCheckInDate().equals(LocalDate.now())) {
            throw new IllegalStateException("Already checked in today");
        }

        // Record check-in
        shopCoin.recordCheckIn();

        // Standard reward: 100 points (as per user UI)
        Long points = 100L;

        // Optional: Big bonus for Day 7?
        if (shopCoin.getConsecutiveDays() == 7) {
            // Maybe extra bonus, but user image shows +100 for all days.
            // We stick to 100 for now, or maybe 200 for day 7 if desired, but image says
            // +100.
            // However, let's keep it simple 100.
        }

        shopCoin.addPoints(points);
        shopCoin = shopCoinRepository.save(shopCoin);

        log.info("User {} checked in successfully. Points added: {}, Total points: {}",
                userId, points, shopCoin.getPoints());

        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    @Override
    @Transactional
    public ShopCoinDto addPoints(String userId, ShopCoinAddPointsRequest request) {
        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseGet(() -> createNewShopCoin(userId));

        if (request.getPoints() == null || request.getPoints() <= 0) {
            throw new IllegalArgumentException("Points must be greater than 0");
        }

        shopCoin.addPoints(request.getPoints());
        shopCoin = shopCoinRepository.save(shopCoin);

        log.info("Added {} points to user {}. Total points: {}",
                request.getPoints(), userId, shopCoin.getPoints());

        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    @Override
    @Transactional
    public ShopCoinDto getOrCreateShopCoin(String userId) {
        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseGet(() -> createNewShopCoin(userId));
        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasCheckedInToday(String userId) {
        return shopCoinRepository.findByUserIdAndCheckedInToday(userId).isPresent();
    }

    private final com.example.userservice.repository.UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<com.example.userservice.dto.ShopCoinAdminDto> getAllShopCoins(
            org.springframework.data.domain.Pageable pageable) {
        return shopCoinRepository.findAll(pageable)
                .map(shopCoin -> {
                    com.example.userservice.model.User user = userRepository.findById(shopCoin.getUserId())
                            .orElse(null);
                    return com.example.userservice.dto.ShopCoinAdminDto.builder()
                            .userId(shopCoin.getUserId())
                            .username(user != null ? user.getUsername() : "Unknown")
                            .email(user != null ? user.getEmail() : "Unknown")
                            .points(shopCoin.getPoints())
                            .lastCheckInDate(shopCoin.getLastCheckInDate())
                            .consecutiveDays(shopCoin.getConsecutiveDays())
                            .build();
                });
    }

    @Override
    @Transactional
    public ShopCoinDto performViewProductMission(String userId) {
        log.info("Performing View Product mission action for user: {}", userId);
        try {
            performMissionAction(userId, "VIEW_PRODUCT");
        } catch (Exception e) {
            log.warn("Failed to update mission progress for VIEW_PRODUCT: {}", e.getMessage());
            // Ignore if mission doesn't exist or other non-critical error
        }
        return getOrCreateShopCoin(userId);
    }

    @Override
    @Transactional
    public void performReviewMission(String userId) {
        log.info("Performing Review verification for user: {}", userId);

        Boolean hasReviewed = stockServiceClient.hasUserReviewedToday(userId).getBody();
        if (Boolean.FALSE.equals(hasReviewed)) {
            throw new RuntimeException("Bạn chưa có đánh giá mới nào hôm nay!");
        }

        try {
            performMissionAction(userId, "REVIEW_ORDER");
        } catch (Exception e) {
            throw new RuntimeException("Lỗi cập nhật nhiệm vụ: " + e.getMessage());
        }

        // We don't award points here anymore. User must claim in UI.
        log.info("Updated progress for Review Mission for user {}", userId);
    }

    @Override
    @Transactional
    public com.example.userservice.model.Mission createMission(
            com.example.userservice.request.shopCoin.MissionRequest request) {
        com.example.userservice.model.Mission mission = com.example.userservice.model.Mission.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .rewardAmount(request.getRewardAmount())
                .actionCode(request.getActionCode())
                .targetCount(request.getTargetCount() != null ? request.getTargetCount() : 1)
                .build();
        return missionRepository.save(mission);
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.List<com.example.userservice.dto.MissionDto> getAllMissions() {
        return missionRepository.findAll().stream()
                .map(mission -> modelMapper.map(mission, com.example.userservice.dto.MissionDto.class))
                .collect(java.util.stream.Collectors.toList());
    }

    @Override
    @Transactional
    public java.util.List<com.example.userservice.dto.UserMissionDto> getMissionsForUser(String userId) {
        java.util.List<com.example.userservice.model.Mission> allMissions = missionRepository.findAll();
        LocalDate today = LocalDate.now();

        return allMissions.stream().map(mission -> {
            com.example.userservice.model.UserMission userMission = userMissionRepository
                    .findByUserIdAndMissionId(userId, mission.getId())
                    .orElseGet(() -> com.example.userservice.model.UserMission.builder()
                            .userId(userId)
                            .mission(mission)
                            .progress(0)
                            .completed(false)
                            .claimed(false)
                            .lastUpdatedDate(today)
                            .build());

            // Lazy Reset Logic
            if (userMission.getLastUpdatedDate() == null || !userMission.getLastUpdatedDate().equals(today)) {
                userMission.setProgress(0);
                userMission.setCompleted(false);
                userMission.setClaimed(false);
                userMission.setLastUpdatedDate(today);
                userMission = userMissionRepository.save(userMission);
            }

            return com.example.userservice.dto.UserMissionDto.builder()
                    .id(userMission.getId())
                    .missionId(mission.getId())
                    .title(mission.getTitle())
                    .description(mission.getDescription())
                    .rewardAmount(mission.getRewardAmount())
                    .actionCode(mission.getActionCode())
                    .targetCount(mission.getTargetCount())
                    .progress(userMission.getProgress())
                    .completed(userMission.getCompleted())
                    .claimed(userMission.getClaimed())
                    .build();
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public com.example.userservice.dto.UserMissionDto performMissionAction(String userId, String actionCode) {
        com.example.userservice.model.Mission mission = missionRepository.findByActionCode(actionCode)
                .orElseThrow(() -> new NotFoundException("Mission not found with code: " + actionCode));

        LocalDate today = LocalDate.now();
        com.example.userservice.model.UserMission userMission = userMissionRepository
                .findByUserIdAndMissionId(userId, mission.getId())
                .orElseGet(() -> com.example.userservice.model.UserMission.builder()
                        .userId(userId)
                        .mission(mission)
                        .progress(0)
                        .completed(false)
                        .claimed(false)
                        .lastUpdatedDate(today)
                        .build());

        // Check reset
        if (userMission.getLastUpdatedDate() == null || !userMission.getLastUpdatedDate().equals(today)) {
            userMission.setProgress(0);
            userMission.setCompleted(false);
            userMission.setClaimed(false);
            userMission.setLastUpdatedDate(today);
        }

        if (userMission.getCompleted()) {
            // Already completed
            return com.example.userservice.dto.UserMissionDto.builder()
                    .id(userMission.getId())
                    .missionId(mission.getId())
                    .title(mission.getTitle())
                    .description(mission.getDescription())
                    .rewardAmount(mission.getRewardAmount())
                    .actionCode(mission.getActionCode())
                    .targetCount(mission.getTargetCount())
                    .progress(userMission.getProgress())
                    .completed(userMission.getCompleted())
                    .claimed(userMission.getClaimed())
                    .build();
        }

        userMission.setProgress(userMission.getProgress() + 1);
        if (userMission.getProgress() >= mission.getTargetCount()) {
            userMission.setProgress(mission.getTargetCount());
            userMission.setCompleted(true);
        }
        userMission.setLastUpdatedDate(today);

        userMission = userMissionRepository.save(userMission);

        return com.example.userservice.dto.UserMissionDto.builder()
                .id(userMission.getId())
                .missionId(mission.getId())
                .title(mission.getTitle())
                .description(mission.getDescription())
                .rewardAmount(mission.getRewardAmount())
                .actionCode(mission.getActionCode())
                .targetCount(mission.getTargetCount())
                .progress(userMission.getProgress())
                .completed(userMission.getCompleted())
                .claimed(userMission.getClaimed())
                .build();
    }

    @Override
    @Transactional
    public ShopCoinDto claimMissionReward(String userId, String missionId) {
        com.example.userservice.model.UserMission userMission = userMissionRepository
                .findByUserIdAndMissionId(userId, missionId)
                .orElseThrow(() -> new NotFoundException("User mission progress not found"));

        if (!userMission.getCompleted()) {
            throw new IllegalStateException("Mission not completed yet");
        }
        if (userMission.getClaimed()) {
            throw new IllegalStateException("Reward already claimed");
        }

        // Add points
        ShopCoin shopCoin = getOrCreateShopCoinEntity(userId);
        shopCoin.addPoints(userMission.getMission().getRewardAmount());
        shopCoinRepository.save(shopCoin);

        // Mark claimed
        userMission.setClaimed(true);
        userMissionRepository.save(userMission);

        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    private ShopCoin getOrCreateShopCoinEntity(String userId) {
        return shopCoinRepository.findByUserId(userId)
                .orElseGet(() -> createNewShopCoin(userId));
    }

    private ShopCoin createNewShopCoin(String userId) {
        ShopCoin shopCoin = ShopCoin.builder()
                .userId(userId)
                .points(0L)
                .isCheckedInToday(false)
                .consecutiveDays(0)
                .build();

        log.info("Creating new ShopCoin for user: {}", userId);
        return shopCoinRepository.save(shopCoin);
    }

    @Override
    @Transactional
    public com.example.userservice.model.Mission updateMission(String id,
            com.example.userservice.request.shopCoin.MissionRequest request) {
        com.example.userservice.model.Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Mission not found with id: " + id));

        mission.setTitle(request.getTitle());
        mission.setDescription(request.getDescription());
        mission.setRewardAmount(request.getRewardAmount());
        mission.setActionCode(request.getActionCode());
        mission.setTargetCount(request.getTargetCount() != null ? request.getTargetCount() : 1);

        return missionRepository.save(mission);
    }

    @Override
    @Transactional
    public void deleteMission(String id) {
        com.example.userservice.model.Mission mission = missionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Mission not found with id: " + id));

        // Delete associated user progress first
        // Ideally use a custom query deleteByMissionId but for now iterating is safer
        // if
        // cascade not set
        // But since we didn't add delete method to repo, let's just use entity mapping
        // if
        // present or add one.
        // Actually UserMission has ManyToOne to Mission.
        // Let's iterate and delete or add a delete method to UserMissionRepository?
        // Let's add deleteByMissionId to Repo first? Or just fetching all is slow.
        // Let's try to delete via repo built-in deleteAll
        java.util.List<com.example.userservice.model.UserMission> userMissions = userMissionRepository.findAll()
                .stream()
                .filter(um -> um.getMission().getId().equals(id))
                .collect(java.util.stream.Collectors.toList());
        userMissionRepository.deleteAll(userMissions);

        missionRepository.delete(mission);
    }

    @Override
    @Transactional
    public ShopCoinDto addGamePoints(String userId, int score) {
        // Conversion rate: 1 score = 1 point
        long pointsToAdd = score;

        if (pointsToAdd <= 0) {
            log.warn("Score {} is not enough to convert to points for user {}", score, userId);
            return getOrCreateShopCoin(userId);
        }

        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseGet(() -> createNewShopCoin(userId));

        shopCoin.addPoints(pointsToAdd);
        shopCoin = shopCoinRepository.save(shopCoin);

        log.info("Added {} game points to user {} from score {}. Total points: {}",
                pointsToAdd, userId, score, shopCoin.getPoints());

        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }

    @Override
    @Transactional
    public ShopCoinDto deductPoints(String userId, long points) {
        ShopCoin shopCoin = shopCoinRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("ShopCoin not found for user: " + userId));

        if (points <= 0) {
            throw new IllegalArgumentException("Points to deduct must be greater than 0");
        }

        shopCoin.deductPoints(points);
        shopCoin = shopCoinRepository.save(shopCoin);

        log.info("Deducted {} points from user {}. Remaining points: {}",
                points, userId, shopCoin.getPoints());

        return modelMapper.map(shopCoin, ShopCoinDto.class);
    }
}
